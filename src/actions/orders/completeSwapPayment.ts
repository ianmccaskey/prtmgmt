import { action } from '@uibakery/data';

/**
 * Settles a completed Chainflip swap payment with the on-chain truth: the
 * destination (Ethereum USDC) egress TX hash and the ACTUAL delivered
 * amount replace the estimate, and the payment verifies. Refuses (0 rows)
 * unless the payment is still the pending swap it claims to be —
 * idempotent against the sync and the drawer button racing. Callers chain
 * recomputePaymentStatus after.
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
