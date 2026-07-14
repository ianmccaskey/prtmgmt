import { action } from '@uibakery/data';
import { paymentRollupSql } from './paymentRollupSql';

export function markRefundVerified() {
  return action('markRefundVerified', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE refund_tasks SET status = 'verified', verified_at = NOW() WHERE id = {{params.taskId}}::bigint;
      UPDATE order_payments SET verification_status = 'verified', verified_at = NOW(), verified_by_user_id = {{params.userId}}
        WHERE id = (SELECT linked_payment_id FROM refund_tasks WHERE id = {{params.taskId}}::bigint);
${paymentRollupSql(`SELECT sales_order_id FROM refund_tasks WHERE id = {{params.taskId}}::bigint`)};
    `,
  });
}

export default markRefundVerified;
