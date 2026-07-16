import { action } from '@uibakery/data';

export function getChinaDirectQueue() {
  return action('getChinaDirectQueue', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT DISTINCT
        so.id,
        so.order_number,
        so.order_date,
        so.status,
        so.payment_status,
        so.total_usd,
        c.full_name AS customer_name,
        CURRENT_DATE - so.order_date AS days_waiting,
        EXISTS(SELECT 1 FROM sales_order_items soi2 WHERE soi2.sales_order_id = so.id AND soi2.fulfillment_source = 'warehouse') AS has_warehouse_lines,
        (SELECT f.name FROM factories f
          JOIN products p ON p.factory_id = f.id
          JOIN sales_order_items soi3 ON soi3.product_id = p.id
          WHERE soi3.sales_order_id = so.id AND soi3.fulfillment_source = 'china_direct'
          LIMIT 1) AS factory_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      WHERE soi.fulfillment_source = 'china_direct'
        AND so.status = 'confirmed'
      ORDER BY so.order_date ASC
    `,
  });
}

export default getChinaDirectQueue;
