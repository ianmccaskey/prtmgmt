import { action } from '@uibakery/data';

export function createRefundTask() {
  return action('createRefundTask', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO refund_tasks (
        sales_order_id, created_by_user_id, amount_usd_owed, reason, assignee_user_id, due_date, status
      ) VALUES (
        {{params.orderId}}::bigint,
        {{params.userId}},
        {{params.amountUsdOwed}}::numeric,
        {{params.reason}},
        {{params.assigneeUserId}},
        {{params.dueDate}}::date,
        'owed'
      )
    `,
  });
}

export default createRefundTask;
