import { action } from '@uibakery/data';

function getBatchOrders() {
  return action('getBatchOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS order_id, so.order_number, so.order_date, so.status,
        c.full_name AS customer_name,
        soia.quantity AS qty_allocated
      FROM sales_order_item_allocations soia
      JOIN sales_order_items soi ON soi.id = soia.sales_order_item_id
      JOIN sales_orders so ON so.id = soi.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      WHERE soia.batch_id = {{params.batch_id}}
      ORDER BY so.order_date DESC
    `,
  });
}

export default getBatchOrders;
