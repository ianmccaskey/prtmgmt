import { action } from '@uibakery/data';

/**
 * Idempotent, data-derived status update after a warehouse ship pass:
 * shipped when every warehouse line is fully allocated AND every china line
 * (if any) already has a china-origin outbound shipment; else
 * partially_shipped. Safe to re-run (repairs a chain that failed mid-way).
 */
function markOrderShippedFromWarehouse() {
  return action('markOrderShippedFromWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders
      SET status = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM sales_order_items soi
          LEFT JOIN (
            SELECT sales_order_item_id, SUM(quantity) AS q
            FROM sales_order_item_allocations GROUP BY sales_order_item_id
          ) a ON a.sales_order_item_id = soi.id
          WHERE soi.sales_order_id = {{params.order_id}}::bigint
            AND soi.fulfillment_source = 'warehouse'
            AND COALESCE(a.q, 0) < soi.quantity
        )
        AND NOT EXISTS (
          SELECT 1 FROM sales_order_items soi
          WHERE soi.sales_order_id = {{params.order_id}}::bigint
            AND soi.fulfillment_source = 'china_direct'
            AND NOT EXISTS (
              SELECT 1 FROM shipments_outbound sob
              WHERE sob.sales_order_id = soi.sales_order_id AND sob.origin = 'china'
            )
        )
        THEN 'shipped' ELSE 'partially_shipped' END
      WHERE id = {{params.order_id}}::bigint
      RETURNING id, status
    `,
  });
}

export default markOrderShippedFromWarehouse;
