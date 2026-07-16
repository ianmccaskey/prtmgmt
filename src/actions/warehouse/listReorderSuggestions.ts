import { action } from '@uibakery/data';

function listReorderSuggestions() {
  return action('listReorderSuggestions', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.id AS product_id, p.sku, p.name AS product_name, p.low_stock_threshold,
        COALESCE(SUM(i.quantity_on_hand - i.quantity_reserved), 0) AS total_available,
        COALESCE((
          SELECT SUM(sii.quantity_shipped - COALESCE(sii.quantity_received, 0))
          FROM shipments_inbound_items sii
          JOIN shipments_inbound si ON si.id = sii.shipment_id
          WHERE sii.product_id = p.id AND si.status != 'delivered'
        ), 0) AS in_transit_inbound,
        -- Velocity = kits committed in the last 30 days; cancelled/draft and
        -- free orders are excluded (prompt rule). Was COUNT(*) of line rows.
        COALESCE((
          SELECT SUM(soi.quantity)
          FROM sales_order_items soi
          JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE soi.product_id = p.id
            AND so.order_date >= CURRENT_DATE - INTERVAL '30 days'
            AND so.status IN ('confirmed','partially_shipped','shipped','delivered')
            AND so.is_free_order = false
        ), 0) AS sales_last_30d
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = true AND p.available_warehouse = true
        AND p.low_stock_threshold IS NOT NULL
      GROUP BY p.id
      HAVING COALESCE(SUM(i.quantity_on_hand - i.quantity_reserved), 0) <= p.low_stock_threshold
      ORDER BY total_available ASC
    `,
  });
}

export default listReorderSuggestions;
