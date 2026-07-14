import { action } from '@uibakery/data';

export function getOrderDetail() {
  return action('getOrderDetail', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.*,
        c.full_name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.preferred_channel AS customer_channel,
        c.channel_handle AS customer_handle,
        c.is_vip,
        c.is_blocked,
        c.blocked_reason,
        fr.label AS free_order_reason_label,
        rep.display_name AS sales_rep_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      LEFT JOIN free_order_reasons fr ON fr.id = so.free_order_reason_id
      LEFT JOIN user_profiles rep ON rep.id = so.sales_rep_user_profile_id
      WHERE so.id = {{params.orderId}}::bigint
    `,
  });
}

export default getOrderDetail;
