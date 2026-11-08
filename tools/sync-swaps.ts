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
 * Every unresolved row is checked on every run. An address that never saw
 * money is dropped a week after it closes; a row with money in it is
 * checked until it resolves. Old Chainflip rows are ignored: all finished.
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

// Notes this job writes start with this, so it can replace or clear its own
// notes without touching one a person wrote. completeSwapPayment.ts clears
// the same prefix.
const AUTO = 'Swap check: ';

type Row = { id: number; sales_order_id: number; swap_deposit_address: string; swap_state: string | null; swap_expires_at: string | null };

async function recompute(orderId: number) {
  // Same derivation as src/actions/orders/recomputePaymentStatus.ts. Keep
  // the two identical.
  await sql`
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
    ) sub
    WHERE so.id = sub.id`;
}

/** Moves the row to `state` and records the issue, unless a person already wrote a note. */
async function flag(id: number, state: string, issueType: string, note: string) {
  await sql`
    UPDATE order_payments SET
      issue_type = CASE WHEN COALESCE(issue_notes, '') = '' OR issue_notes LIKE 'Swap check:%' THEN ${issueType} ELSE issue_type END,
      issue_notes = CASE WHEN COALESCE(issue_notes, '') = '' OR issue_notes LIKE 'Swap check:%' THEN ${AUTO + note} ELSE issue_notes END,
      swap_state = ${state}
    WHERE id = ${id} AND verification_status = 'pending'`;
}

function refundNote(st: OneClickStatus, heading: string) {
  const amount = st.refundedAmount ? ` Refunded amount: ${st.refundedAmount}.` : '';
  const reason = st.refundReason ? ` Reason: ${st.refundReason}.` : '';
  return `${heading}${amount}${reason} Check the refund address on this payment, then re-collect from the customer if needed.`;
}

/** Returns which counter this row should bump, or null for no change. */
async function settle(r: Row): Promise<'completed' | 'flagged' | 'updated' | null> {
  const st = await getOneClickStatus(r.swap_deposit_address, apiBase);
  const closed = !!r.swap_expires_at && Date.parse(r.swap_expires_at) < Date.now();

  switch (st.state) {
    case 'NOT_FOUND':
      // Not proof that nothing was sent, so this never reads as "no deposit".
      // Once the address should have closed, a person has to look.
      if (!closed || r.swap_state === 'EXPIRED') {
        console.warn(`payment ${r.id}: 1Click doesn't know this address`);
        return null;
      }
      await flag(r.id, 'EXPIRED', 'other',
        '1Click has no record of this deposit address. Search it on the NEAR Intents Explorer and a block explorer before telling the customer anything.');
      return 'flagged';

    case 'SUCCESS': {
      if (!st.egressTx || st.egressUsdc == null) {
        if (r.swap_state === 'SUCCESS') return null;
        await flag(r.id, 'SUCCESS', 'other',
          'Swap finished, but its delivery record needs checking by hand: expected exactly one Ethereum TX and an amount. Find the delivery on the NEAR Intents Explorer, then an admin adds the TX hash, corrects the amount, and marks the payment verified.');
        return 'flagged';
      }
      const done = await sql`
        UPDATE order_payments SET
          tx_hash = ${st.egressTx},
          amount_usd = ROUND(${st.egressUsdc}::numeric, 2),
          verification_status = 'verified',
          verified_at = NOW(),
          issue_type = CASE WHEN issue_notes LIKE 'Swap check:%' THEN NULL ELSE issue_type END,
          issue_notes = CASE WHEN issue_notes LIKE 'Swap check:%' THEN NULL ELSE issue_notes END,
          swap_state = 'COMPLETED'
        WHERE id = ${r.id} AND verification_status = 'pending' AND swap_channel_id IS NOT NULL
        RETURNING id` as { id: number }[];
      if (!done.length) return null;
      await recompute(r.sales_order_id);
      return 'completed';
    }

    case 'REFUNDED':
      await flag(r.id, 'REFUNDED', 'other', refundNote(st, 'Swap REFUNDED: the deposit went back to the refund address.'));
      return 'flagged';

    case 'FAILED':
      await flag(r.id, 'FAILED', 'other', refundNote(st, 'Swap FAILED: 1Click reports an error.'));
      return 'flagged';

    case 'INCOMPLETE_DEPOSIT':
      if (r.swap_state === 'INCOMPLETE_DEPOSIT') return null;
      await flag(r.id, 'INCOMPLETE_DEPOSIT', 'underpaid',
        'Deposit is below the minimum, so it has not been swapped. The customer may be able to top up to the same address before the deadline; otherwise 1Click refunds it to the refund address.');
      return 'flagged';

    case 'PENDING_DEPOSIT':
      if (!closed || r.swap_state === 'EXPIRED') return null;
      await flag(r.id, 'EXPIRED', 'other',
        'Deposit address EXPIRED with nothing received. Tell the customer not to send to it, and open a new one if they still intend to pay.');
      return 'flagged';

    default:
      // KNOWN_DEPOSIT_TX, PROCESSING, or a status added later.
      if (r.swap_state === 'EXPIRED') {
        await flag(r.id, st.state, 'other',
          'A deposit arrived AFTER the address closed. Search the deposit address on the NEAR Intents Explorer, and contact 1Click if it doesn\'t complete.');
        return 'flagged';
      }
      if (st.state === r.swap_state) return null;
      await sql`UPDATE order_payments SET swap_state = ${st.state} WHERE id = ${r.id} AND verification_status = 'pending'`;
      return 'updated';
  }
}

async function main() {
  const rows = await sql`
    SELECT op.id, op.sales_order_id, op.swap_deposit_address, op.swap_state, op.swap_expires_at
    FROM order_payments op
    WHERE op.swap_provider = 'oneclick'
      AND op.verification_status = 'pending'
      AND op.swap_state NOT IN ('REFUNDED', 'FAILED')
      AND (op.swap_state NOT IN ('PENDING_DEPOSIT', 'EXPIRED')
           OR op.swap_expires_at > NOW() - make_interval(days => ${LATE_POLL_DAYS}))
    ORDER BY op.id
  ` as Row[];
  console.log(`${rows.length} pending swap payment(s)`);

  const counts = { completed: 0, flagged: 0, updated: 0, errors: 0 };
  for (const r of rows) {
    try {
      const outcome = await settle(r);
      if (outcome) counts[outcome]++;
    } catch (e) {
      counts.errors++;
      console.error(`payment ${r.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // A swap verified here or in the drawer whose follow-up recompute failed
  // would leave its order unpaid with nothing to retry it. Recomputing every
  // order with a recently verified swap is idempotent and catches that.
  const recent = await sql`
    SELECT DISTINCT sales_order_id FROM order_payments
    WHERE swap_provider = 'oneclick' AND verification_status = 'verified'
      AND verified_at > NOW() - make_interval(days => ${LATE_POLL_DAYS})
  ` as { sales_order_id: number }[];
  for (const o of recent) {
    try {
      await recompute(o.sales_order_id);
    } catch (e) {
      counts.errors++;
      console.error(`order ${o.sales_order_id} recompute: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`completed=${counts.completed} flagged=${counts.flagged} state_updates=${counts.updated} errors=${counts.errors}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
