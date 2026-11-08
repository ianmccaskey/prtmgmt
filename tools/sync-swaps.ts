/**
 * Settles pending 1Click auto-swap payments (customer sent BTC or USDT on
 * Tron to a one-time address; 1Click delivers USDC to our Ethereum wallet).
 * There are no webhooks, so each pending swap's status is polled and:
 *  - SUCCESS → writes the delivery TX hash + ACTUAL USDC amount, verifies
 *    the payment, and recomputes the order's payment status
 *  - INCOMPLETE_DEPOSIT / REFUNDED / FAILED → flags the payment for review
 *  - no deposit by the time the address closes → marks it EXPIRED
 *  - otherwise → records the latest state so the drawer shows progress
 *
 * Once a deposit has been seen, a row never goes back to EXPIRED: it is
 * checked until it resolves. An address that never saw money is dropped a
 * week after it closes. Rows are checked in random order within a time
 * budget, so slow ones can't starve the rest. Old Chainflip rows are
 * ignored: they are all finished.
 *
 * Runs from .github/workflows/swaps-sync.yml (cron-job.org, hourly); safe to
 * run locally too. Setup: DATABASE_URL in the environment (or .env.local).
 * No API key needed.
 */
import { SQL } from 'bun';
import { getOneClickStatus, OneClickStatus } from '../src/lib/oneClick';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Create .env.local at the repo root:');
  console.error('  DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require');
  process.exit(1);
}
const sql = new SQL(url);

// Test hook: points the status call at a mock instead of the real API.
const apiBase = process.env.ONECLICK_API_BASE || undefined;

const LATE_POLL_DAYS = 7;
const CONCURRENCY = 4;
// The workflow is killed at 10 minutes; leave room for the repair pass.
const POLL_BUDGET_MS = 6 * 60_000;

// Notes this job writes start with this, so it can replace or clear its own
// notes without touching one a person wrote. completeSwapPayment.ts clears
// the same prefix, and the drawer's Flag Issue strips it when a person saves.
const AUTO = 'Swap check: ';
const isAuto = (n: string | null) => !!n && n.startsWith('Swap check:');

type Row = {
  id: number; sales_order_id: number; swap_deposit_address: string;
  swap_state: string | null; swap_expires_at: string | null; issue_notes: string | null;
};

/**
 * Re-derives payment_status: for one order, or (orderId null) for every
 * order with a verified 1Click swap. Same derivation as
 * src/actions/orders/recomputePaymentStatus.ts; keep the two identical.
 * Writes only where the stored status is stale.
 */
async function recompute(orderId: number | null) {
  const fixed = await sql`
    UPDATE sales_orders so
    SET payment_status = sub.derived
    FROM (
      SELECT o.id,
        CASE
          WHEN rp.division = 'china' THEN 'paid'
          WHEN COALESCE(p.refund_cnt, 0) > 0 AND COALESCE(p.net, 0) <= 0 THEN 'refunded'
          WHEN COALESCE(p.net, 0) >= o.total_usd THEN 'paid'
          WHEN COALESCE(p.net, 0) > 0 THEN 'partial_paid'
          ELSE 'unpaid'
        END AS derived
      FROM sales_orders o
      LEFT JOIN user_profiles rp ON rp.id = o.sales_rep_user_profile_id
      LEFT JOIN (
        SELECT sales_order_id,
          SUM(CASE WHEN direction = 'incoming' THEN amount_usd ELSE -amount_usd END) AS net,
          COUNT(*) FILTER (WHERE direction = 'refund') AS refund_cnt
        FROM order_payments
        WHERE verification_status = 'verified'
        GROUP BY sales_order_id
      ) p ON p.sales_order_id = o.id
      WHERE o.id = ${orderId}
         OR (${orderId}::bigint IS NULL AND o.id IN (
              SELECT sales_order_id FROM order_payments
              WHERE swap_provider = 'oneclick' AND verification_status = 'verified'))
    ) sub
    WHERE so.id = sub.id AND so.payment_status IS DISTINCT FROM sub.derived
    RETURNING so.id` as { id: number }[];
  return fixed.length;
}

/**
 * Moves the row to `state` and records the issue, unless a person already
 * wrote a note. Returns false when nothing would change.
 */
async function flag(r: Row, state: string, issueType: string, note: string): Promise<boolean> {
  const staffNote = !!r.issue_notes && !isAuto(r.issue_notes);
  if (r.swap_state === state && (r.issue_notes === AUTO + note || staffNote)) return false;
  await sql`
    UPDATE order_payments SET
      issue_type = CASE WHEN COALESCE(issue_notes, '') = '' OR issue_notes LIKE 'Swap check:%' THEN ${issueType} ELSE issue_type END,
      issue_notes = CASE WHEN COALESCE(issue_notes, '') = '' OR issue_notes LIKE 'Swap check:%' THEN ${AUTO + note} ELSE issue_notes END,
      swap_state = ${state}
    WHERE id = ${r.id} AND verification_status = 'pending'`;
  return true;
}

function refundNote(st: OneClickStatus, heading: string) {
  const amount = st.refundedAmount ? ` Refunded amount: ${st.refundedAmount}.` : '';
  const reason = st.refundReason ? ` Reason: ${st.refundReason}.` : '';
  return `${heading}${amount}${reason} Check the refund address on this payment, then re-collect from the customer if needed.`;
}

type Outcome = 'completed' | 'flagged' | 'updated' | null;
const flagged = (changed: boolean): Outcome => (changed ? 'flagged' : null);

async function settle(r: Row): Promise<Outcome> {
  const st = await getOneClickStatus(r.swap_deposit_address, apiBase);
  const closed = !!r.swap_expires_at && Date.parse(r.swap_expires_at) < Date.now();
  // Only an address that never saw money can be called EXPIRED.
  const neverFunded = r.swap_state === 'PENDING_DEPOSIT';

  switch (st.state) {
    case 'NOT_FOUND':
      // Not proof that nothing was sent, so this never reads as "no deposit".
      if (!closed || r.swap_state === 'EXPIRED') {
        console.warn(`payment ${r.id}: 1Click doesn't know this address`);
        return null;
      }
      if (neverFunded) {
        return flagged(await flag(r, 'EXPIRED', 'other',
          '1Click has no record of this deposit address. Search it on the NEAR Intents Explorer and a block explorer before telling the customer anything.'));
      }
      // Funded earlier: keep the state, so the row stays watched.
      return flagged(await flag(r, String(r.swap_state), 'other',
        '1Click no longer recognises this deposit address, although a deposit was seen earlier. Search it on the NEAR Intents Explorer and contact 1Click.'));

    case 'SUCCESS': {
      if (!st.egressTx || st.egressUsdc == null) {
        return flagged(await flag(r, 'SUCCESS', 'other',
          'Swap finished, but its delivery record needs checking by hand: expected exactly one Ethereum TX and an amount. An admin finds the delivery on the NEAR Intents Explorer and records it with "Record delivery by hand".'));
      }
      // One receipt can't pay twice: refuse a delivery TX already credited to
      // another live incoming USDC/Ethereum payment (e.g. a rep also entered
      // it as a direct payment). completeSwapPayment.ts and
      // createOrderPayment.ts apply the same rule.
      const dup = await sql`
        SELECT id FROM order_payments
        WHERE id <> ${r.id} AND direction = 'incoming' AND verification_status <> 'failed'
          AND asset = 'USDC' AND network = 'ethereum'
          AND LOWER(tx_hash) = LOWER(${st.egressTx})
        LIMIT 1` as { id: number }[];
      if (dup.length) {
        return flagged(await flag(r, 'SUCCESS', 'other',
          `Swap finished, but its delivery TX is already recorded on payment #${dup[0].id}. Check whether that record is a duplicate of this swap before crediting anything.`));
      }
      const done = await sql`
        UPDATE order_payments op SET
          tx_hash = ${st.egressTx},
          amount_usd = ROUND(${st.egressUsdc}::numeric, 2),
          verification_status = 'verified',
          verified_at = NOW(),
          issue_type = CASE WHEN op.issue_notes LIKE 'Swap check:%' THEN NULL ELSE op.issue_type END,
          issue_notes = CASE WHEN op.issue_notes LIKE 'Swap check:%' THEN NULL ELSE op.issue_notes END,
          swap_state = 'COMPLETED'
        WHERE op.id = ${r.id} AND op.verification_status = 'pending' AND op.swap_channel_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM order_payments o2
            WHERE o2.id <> op.id AND o2.direction = 'incoming' AND o2.verification_status <> 'failed'
              AND o2.asset = op.asset AND o2.network = op.network
              AND LOWER(o2.tx_hash) = LOWER(${st.egressTx}))
        RETURNING op.id` as { id: number }[];
      if (!done.length) return null;
      await recompute(r.sales_order_id);
      return 'completed';
    }

    case 'REFUNDED':
      return flagged(await flag(r, 'REFUNDED', 'other', refundNote(st, 'Swap REFUNDED: the deposit went back to the refund address.')));

    case 'FAILED':
      return flagged(await flag(r, 'FAILED', 'other', refundNote(st, 'Swap FAILED: 1Click reports an error.')));

    case 'INCOMPLETE_DEPOSIT':
      return flagged(await flag(r, 'INCOMPLETE_DEPOSIT', 'underpaid',
        'Deposit is below the minimum, so it has not been swapped. The customer may be able to top up to the same address before the deadline; otherwise 1Click refunds it to the refund address.'));

    case 'PENDING_DEPOSIT':
      if (!closed || !neverFunded) return null;
      return flagged(await flag(r, 'EXPIRED', 'other',
        'Deposit address EXPIRED with nothing received. Tell the customer not to send to it, and open a new one if they still intend to pay.'));

    default:
      // KNOWN_DEPOSIT_TX, PROCESSING, or a status added later.
      if (r.swap_state === 'EXPIRED') {
        return flagged(await flag(r, st.state, 'other',
          'A deposit arrived AFTER the address closed. Search the deposit address on the NEAR Intents Explorer, and contact 1Click if it doesn\'t complete.'));
      }
      if (st.state === r.swap_state) return null;
      await sql`UPDATE order_payments SET swap_state = ${st.state} WHERE id = ${r.id} AND verification_status = 'pending'`;
      return 'updated';
  }
}

async function main() {
  const counts = { completed: 0, flagged: 0, updated: 0, errors: 0, repaired: 0 };

  // First, so it runs even if polling uses the whole budget: a swap verified
  // here or in the drawer whose follow-up recompute failed would otherwise
  // leave its order showing unpaid.
  try { counts.repaired += await recompute(null); }
  catch (e) { counts.errors++; console.error(`repair pass: ${e instanceof Error ? e.message : e}`); }

  const rows = await sql`
    SELECT op.id, op.sales_order_id, op.swap_deposit_address, op.swap_state, op.swap_expires_at, op.issue_notes
    FROM order_payments op
    WHERE op.swap_provider = 'oneclick'
      AND op.verification_status = 'pending'
      AND op.swap_state NOT IN ('REFUNDED', 'FAILED')
      AND (op.swap_state NOT IN ('PENDING_DEPOSIT', 'EXPIRED')
           OR op.swap_expires_at > NOW() - make_interval(days => ${LATE_POLL_DAYS}))
    ORDER BY random()
  ` as Row[];
  console.log(`${rows.length} pending swap payment(s)`);

  const started = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < rows.length && Date.now() - started < POLL_BUDGET_MS) {
      const r = rows[next++];
      try {
        const outcome = await settle(r);
        if (outcome) counts[outcome]++;
      } catch (e) {
        counts.errors++;
        console.error(`payment ${r.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (next < rows.length) console.warn(`${rows.length - next} swap(s) not checked within the time budget; the next run picks them up`);

  try { counts.repaired += await recompute(null); }
  catch (e) { counts.errors++; console.error(`repair pass: ${e instanceof Error ? e.message : e}`); }

  console.log(`completed=${counts.completed} flagged=${counts.flagged} state_updates=${counts.updated} orders_repaired=${counts.repaired} errors=${counts.errors}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
