import { action } from '@uibakery/data';

/**
 * Single-statement verify; callers chain recomputePaymentStatus with the
 * returned sales_order_id (multi-statement queries can't run as prepared
 * statements).
 */
export function markPaymentVerified() {
  return action('markPaymentVerified', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments
      SET verification_status = 'verified',
          verified_at = NOW(),
          verified_by_user_id = {{params.userId}}
      WHERE id = {{params.paymentId}}::bigint
      RETURNING id, sales_order_id
    `,
  });
}

export default markPaymentVerified;
