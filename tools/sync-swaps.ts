/**
 * Settles pending Chainflip auto-swap payments (customer sent plain BTC to
 * a deposit channel; the protocol swaps and delivers USDC to our Ethereum
 * wallet). For each pending swap payment, polls the swap status and:
 *  - COMPLETED → writes the destination egress TX hash + ACTUAL USDC
 *    amount, verifies the payment, and recomputes the order's payment
 *    status (same china-aware rollup the app uses)
 *  - FAILED / refunded → flags the payment for review (issue note)
 *  - otherwise → records the latest state so the drawer shows progress
 *
 * Runs from .github/workflows/swaps-sync.yml every 15 minutes; safe to run
 * locally too. Setup: DATABASE_URL in the environment (or .env.local).
 * No API key needed — Chainflip's swapping service is public.
 */
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Create .env.local at the repo root:');
  console.error('  DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require');
  process.exit(1);
}
const sql = new SQL(url);

const SWAP_API = 'https://chainflip-swap.chainflip.io';

type Row = { id: number; sales_order_id: number; swap_channel_id: string; swap_state: string | null; swap_expires_at: string | null };

async function getStatus(channelId: string): Promise<{ state: string; egressTx: string | null; egressUsdc: number | null } | null> {
  const res = await fetch(`${SWAP_API}/v2/swaps/${encodeURIComponent(channelId)}`);
  if (res.status === 404) return null; // nothing witnessed yet
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const s = await res.json() as { state?: string; swapEgress?: { txRef?: string; amount?: string } };
  // Strip any colon prefix and prefer a canonical 0x hash — tx_hash must
  // equal the on-chain USDC deposit hash for the wallet audit to match.
  const cleanTx = (t?: string | null) => {
    if (!t) return null;
    const stripped = t.slice(t.lastIndexOf(':') + 1);
    return /^0x[0-9a-fA-F]{64}$/.test(stripped) ? stripped : t;
  };
  return {
    state: String(s.state ?? 'WAITING'),
    egressTx: cleanTx(s.swapEgress?.txRef),
    egressUsdc: s.swapEgress?.amount != null ? Number(s.swapEgress.amount) / 1e6 : null,
  };
}

async function recompute(orderId: number) {
  // Mirrors recomputePaymentStatus: china reps' orders read paid; otherwise
  // derived from verified payments vs total.
  await sql`
    UPDATE sales_orders so SET payment_status = (
      CASE
        WHEN (SELECT rp.division FROM user_profiles rp WHERE rp.id = so.sales_rep_user_profile_id) = 'china' THEN 'paid'
        WHEN COALESCE((SELECT SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END)
                       FROM order_payments op WHERE op.sales_order_id = so.id
                         AND op.verification_status = 'verified'), 0) >= so.total_usd THEN 'paid'
        WHEN COALESCE((SELECT SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END)
                       FROM order_payments op WHERE op.sales_order_id = so.id
                         AND op.verification_status = 'verified'), 0) > 0 THEN 'partial_paid'
        ELSE 'unpaid'
      END)
    WHERE so.id = ${orderId}`;
}

async function main() {
  const rows = await sql`
    SELECT op.id, op.sales_order_id, op.swap_channel_id, op.swap_state, op.swap_expires_at
    FROM order_payments op
    WHERE op.swap_channel_id IS NOT NULL
      AND op.verification_status = 'pending'
      AND op.swap_state IS DISTINCT FROM 'EXPIRED'
    ORDER BY op.id
    LIMIT 100
  ` as Row[];
  console.log(`${rows.length} pending swap payment(s)`);

  let completed = 0, failed = 0, updated = 0, errors = 0;
  for (const r of rows) {
    try {
      const st = await getStatus(r.swap_channel_id);
      const noDeposit = !st || st.state === 'WAITING';
      if (noDeposit && r.swap_expires_at && Date.parse(r.swap_expires_at) < Date.now()) {
        // Channel expired with nothing sent — the customer never paid.
        // Flag for review instead of sitting pending forever.
        await sql`
          UPDATE order_payments SET
            swap_state = 'EXPIRED',
            issue_type = COALESCE(issue_type, 'other'),
            issue_notes = COALESCE(NULLIF(issue_notes, ''),
              'Auto-swap channel EXPIRED with no BTC received — the customer never sent. Open a new deposit channel if they still intend to pay.')
          WHERE id = ${r.id} AND verification_status = 'pending'`;
        failed++;
        continue;
      }
      if (!st) continue; // channel open, nothing sent yet
      if (st.state === 'COMPLETED' && st.egressTx && st.egressUsdc != null) {
        const done = await sql`
          UPDATE order_payments SET
            tx_hash = ${st.egressTx},
            amount_usd = ROUND(${st.egressUsdc}::numeric, 2),
            verification_status = 'verified',
            verified_at = NOW(),
            swap_state = 'COMPLETED'
          WHERE id = ${r.id} AND verification_status = 'pending' AND swap_channel_id IS NOT NULL
          RETURNING id` as { id: number }[];
        if (done.length) { await recompute(r.sales_order_id); completed++; }
      } else if (st.state === 'FAILED') {
        await sql`
          UPDATE order_payments SET
            swap_state = 'FAILED',
            issue_type = COALESCE(issue_type, 'other'),
            issue_notes = COALESCE(NULLIF(issue_notes, ''),
              'Auto-swap FAILED: the Chainflip swap did not complete (BTC may have been refunded to the customer). Review the channel and re-collect if needed.')
          WHERE id = ${r.id} AND verification_status = 'pending'`;
        failed++;
      } else if (st.state !== r.swap_state) {
        await sql`UPDATE order_payments SET swap_state = ${st.state} WHERE id = ${r.id} AND verification_status = 'pending'`;
        updated++;
      }
    } catch (e) {
      errors++;
      console.error(`payment ${r.id} (channel ${r.swap_channel_id}): ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`completed=${completed} failed=${failed} state_updates=${updated} errors=${errors}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
