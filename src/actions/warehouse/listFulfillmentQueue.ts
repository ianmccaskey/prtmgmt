import { action } from '@uibakery/data';

function listFulfillmentQueue() {
  return action('listFulfillmentQueue', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS order_id, so.order_number, so.status, so.order_date,
        so.ship_to_name, so.ship_address_line1, so.ship_city, so.ship_country,
        c.full_name AS customer_name,
        soi.id AS item_id, soi.product_id, soi.quantity, soi.unit_price_usd,
        p.sku, p.name AS product_name,
        COALESCE(SUM(i.quantity_on_hand - i.quantity_reserved), 0) AS stock_available
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      JOIN products p ON p.id = soi.product_id
      LEFT JOIN inventory i ON i.product_id = soi.product_id AND i.warehouse_id::text = COALESCE({{params.warehouse_id}}, i.warehouse_id::text)
      WHERE so.status IN ('confirmed', 'in_production')
        AND soi.fulfillment_source = 'warehouse'
        AND NOT EXISTS (
          SELECT 1 FROM sales_order_item_allocations soia WHERE soia.sales_order_item_id = soi.id
        )
      GROUP BY so.id, c.full_name, soi.id, p.sku, p.name
      ORDER BY so.order_date ASC
    `,
  });
}

export default listFulfillmentQueue;
