import { action } from '@uibakery/data';

export function getOrderAuditLog() {
  return action('getOrderAuditLog', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        oal.*,
        up.display_name AS actor_name
      FROM order_audit_log oal
      LEFT JOIN user_profiles up ON up.id = oal.changed_by_user_id
      WHERE oal.sales_order_id = {{params.orderId}}::bigint
      ORDER BY oal.changed_at DESC
    `,
  });
}

export default getOrderAuditLog;
