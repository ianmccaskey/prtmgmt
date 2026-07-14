import { action } from '@uibakery/data';

export function getRefundTasks() {
  return action('getRefundTasks', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        rt.*,
        so.order_number,
        c.full_name AS customer_name,
        assignee.display_name AS assignee_name,
        creator.display_name AS creator_name,
        CURRENT_DATE - rt.due_date AS days_overdue
      FROM refund_tasks rt
      JOIN sales_orders so ON so.id = rt.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      LEFT JOIN user_profiles assignee ON assignee.user_id = rt.assignee_user_id
      LEFT JOIN user_profiles creator ON creator.user_id = rt.created_by_user_id
      WHERE
        (COALESCE({{params.status}}, '') = '' OR rt.status = {{params.status}})
      ORDER BY
        CASE WHEN rt.status = 'owed' THEN 0 ELSE 1 END,
        rt.due_date ASC NULLS LAST
    `,
  });
}

export default getRefundTasks;
