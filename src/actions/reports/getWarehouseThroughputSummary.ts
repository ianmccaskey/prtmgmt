import { action } from '@uibakery/data';

function getWarehouseThroughputSummary() {
  return action('getWarehouseThroughputSummary', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        SUM(soi.quantity_shipped) AS total_kits_shipped,
        COUNT(DISTINCT DATE_TRUNC('month', so.shipped_date)) AS months_active,
        CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', so.shipped_date)) > 0
          THEN SUM(soi.quantity_shipped)::numeric / COUNT(DISTINCT DATE_TRUNC('month', so.shipped_date))
          ELSE 0 END AS avg_kits_per_month,
        COALESCE(SUM(so.internal_shipping_cost_usd), 0) AS total_shipping_cost,
        CASE WHEN SUM(soi.quantity_shipped) > 0
          THEN SUM(so.internal_shipping_cost_usd) / SUM(soi.quantity_shipped)
          ELSE 0 END AS avg_cost_per_kit
      FROM shipments_outbound so
      JOIN shipments_outbound_items soi ON soi.shipment_id = so.id
      JOIN warehouses w ON w.id = so.origin_warehouse_id
      WHERE so.origin = 'warehouse'
        AND so.shipped_date IS NOT NULL
        AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
      GROUP BY w.id, w.name
      ORDER BY total_kits_shipped DESC
    `,
  });
}

export default getWarehouseThroughputSummary;
