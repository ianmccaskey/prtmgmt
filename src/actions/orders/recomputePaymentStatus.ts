import { action } from '@uibakery/data';

/**
 * Derive sales_orders.payment_status from verified order_payments (pending
 * txs never count):
 *   refunded : any verified refund exists AND net verified sum <= 0
 *   paid     : net >= total_usd (covers $0 free orders)
 *   partial  : 0 < net < total_usd
 *   unpaid   : otherwise
 *
 * Chained by callers after payment inserts/verifies and total changes.
 * The query MUST be a static literal — UI Bakery only registers actions
 * whose SQL is written inline (imported query builders silently produce
 * "action doesn't exist").
 */
export function recomputePaymentStatus() {
  return action('recomputePaymentStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders so
      SET payment_status = sub.derived
      FROM (
        SELECT o.id,
          CASE
            WHEN COALESCE(p.refund_cnt, 0) > 0 AND COALESCE(p.net, 0) <= 0 THEN 'refunded'
            WHEN COALESCE(p.net, 0) >= o.total_usd THEN 'paid'
            WHEN COALESCE(p.net, 0) > 0 THEN 'partial_paid'
            ELSE 'unpaid'
          END AS derived
        FROM sales_orders o
        LEFT JOIN (
          SELECT sales_order_id,
            SUM(CASE WHEN direction = 'incoming' THEN amount_usd ELSE -amount_usd END) AS net,
            COUNT(*) FILTER (WHERE direction = 'refund') AS refund_cnt
          FROM order_payments
          WHERE verification_status = 'verified'
          GROUP BY sales_order_id
        ) p ON p.sales_order_id = o.id
        WHERE o.id = {{params.orderId}}::bigint
      ) sub
      WHERE so.id = sub.id
      RETURNING so.id, so.payment_status
    `,
  });
}

export default recomputePaymentStatus;
