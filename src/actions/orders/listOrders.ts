import { action } from '@uibakery/data';

export function listOrders() {
  return action('listOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id,
        so.order_number,
        so.order_date,
        so.status,
        so.payment_status,
        so.total_usd,
        so.is_free_order,
        so.order_channel,
        so.partial_fulfillment_allowed,
        c.full_name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.channel_handle AS customer_handle,
        c.is_vip,
        c.is_blocked,
        (SELECT EXISTS(SELECT 1 FROM sales_order_items soi WHERE soi.sales_order_id = so.id AND soi.fulfillment_source = 'warehouse')) AS has_warehouse_lines,
        (SELECT EXISTS(SELECT 1 FROM sales_order_items soi WHERE soi.sales_order_id = so.id AND soi.fulfillment_source = 'china_direct')) AS has_china_lines,
        (SELECT COUNT(*) FROM sales_order_items soi WHERE soi.sales_order_id = so.id) AS item_count,
        COALESCE(fr.label, '') AS free_order_reason_label
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      LEFT JOIN free_order_reasons fr ON fr.id = so.free_order_reason_id
      WHERE
        (COALESCE({{params.search}}, '') = ''
          OR so.order_number ILIKE {{ '%' + params.search + '%' }}
          OR c.full_name ILIKE {{ '%' + params.search + '%' }}
          OR c.email ILIKE {{ '%' + params.search + '%' }}
          OR c.phone ILIKE {{ '%' + params.search + '%' }}
          OR c.channel_handle ILIKE {{ '%' + params.search + '%' }}
        )
        AND (COALESCE({{params.status}}, '') = '' OR so.status = {{params.status}})
        AND (COALESCE({{params.paymentStatus}}, '') = '' OR so.payment_status = {{params.paymentStatus}})
        AND (COALESCE({{params.channel}}, '') = '' OR so.order_channel = {{params.channel}})
        AND ({{params.isFreeOrder}} IS NULL OR so.is_free_order = {{params.isFreeOrder}}::boolean)
        AND ({{params.dateFrom}} IS NULL OR so.order_date >= {{params.dateFrom}}::date)
        AND ({{params.dateTo}} IS NULL OR so.order_date <= {{params.dateTo}}::date)
      ORDER BY so.order_date DESC, so.id DESC
      LIMIT 1000
    `,
  });
}

export default listOrders;
