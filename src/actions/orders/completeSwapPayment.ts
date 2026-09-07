import { action } from '@uibakery/data';

/**
 * Settles a completed Chainflip swap payment with the on-chain truth: the
 * destination (Ethereum USDC) egress TX hash and the ACTUAL delivered
 * amount replace the estimate, and the payment verifies. Refuses (0 rows)
 * unless the payment is still the pending swap it claims to be —
 * idempotent against the sync and the drawer button racing. Callers chain
 * recomputePaymentStatus after.
 *
 * Trust model: like every money action in this browser-only app (Correct
 * Amount, Fix Wallet, Mark Verified), the values come from staff's
 * browser — here fetched from Chainflip's status API by the drawer. The
 * cron sync settles the same rows server-side; the wallet audit catches
 * any record whose hash doesn't match a real deposit.
 */
export function completeSwapPayment() {
  return action('completeSwapPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments op
      SET tx_hash = {{params.egressTx}},
          amount_usd = ROUND({{params.egressUsdc}}::numeric, 2),
          verification_status = 'verified',
          verified_at = NOW(),
          verified_by_user_id = {{params.userId}}::bigint,
          swap_state = 'COMPLETED'
      WHERE op.id = {{params.paymentId}}::bigint
        AND op.swap_channel_id IS NOT NULL
        AND op.verification_status = 'pending'
      RETURNING op.id, op.sales_order_id, op.amount_usd
    `,
  });
}

export default completeSwapPayment;
