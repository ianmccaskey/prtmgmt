import { action } from '@uibakery/data';

export function getCustomerOrders() {
  return action('getCustomerOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id,
        so.order_number,
        so.order_date,
        so.status,
        so.payment_status,
        so.total_usd,
        so.order_channel,
        so.is_free_order,
        so.ship_to_name,
        so.ship_address_line1,
        so.ship_city,
        so.ship_state,
        so.ship_country,
        COUNT(soi.id) AS item_count
      FROM sales_orders so
      LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
      WHERE so.customer_id = {{params.customerId}}::bigint
      GROUP BY so.id
      ORDER BY so.order_date DESC
    `,
  });
}

export default getCustomerOrders;
