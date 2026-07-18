import { action } from '@uibakery/data';

/**
 * Single statement (task + linked payment via CTE); callers chain
 * recomputePaymentStatus with the returned sales_order_id.
 */
export function markRefundVerified() {
  return action('markRefundVerified', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH task AS (
        UPDATE refund_tasks
        SET status = 'verified', verified_at = NOW()
        WHERE id = {{params.taskId}}::bigint
        RETURNING linked_payment_id, sales_order_id
      ),
      pay AS (
        UPDATE order_payments
        SET verification_status = 'verified', verified_at = NOW(), verified_by_user_id = {{params.userId}}
        WHERE id = (SELECT linked_payment_id FROM task)
      )
      SELECT sales_order_id FROM task
    `,
  });
}

export default markRefundVerified;
