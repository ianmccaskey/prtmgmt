import { action } from '@uibakery/data';

export function getOrderItems() {
  return action('getOrderItems', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        soi.id,
        soi.sales_order_id,
        soi.product_id,
        soi.quantity,
        soi.unit_price_usd,
        soi.line_total_usd,
        soi.fulfillment_source,
        p.name AS product_name,
        p.sku AS product_sku,
        p.available_warehouse,
        p.available_china_direct,
        EXISTS(
          SELECT 1 FROM shipments_outbound_items soi2
          JOIN shipments_outbound so2 ON so2.id = soi2.shipment_id
          JOIN sales_order_item_allocations alloc ON alloc.id = soi2.allocation_id
          WHERE alloc.sales_order_item_id = soi.id
        ) AS is_shipped
      FROM sales_order_items soi
      JOIN products p ON p.id = soi.product_id
      WHERE soi.sales_order_id = {{params.orderId}}::bigint
      ORDER BY soi.id
    `,
  });
}

export default getOrderItems;
