import { action } from '@uibakery/data';

function getWarehouseThroughput() {
  return action('getWarehouseThroughput', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        TO_CHAR(DATE_TRUNC('month', so.shipped_date), 'YYYY-MM') AS month,
        SUM(soi.quantity_shipped) AS kits_shipped,
        COALESCE(SUM(so.internal_shipping_cost_usd), 0) AS shipping_cost
      FROM shipments_outbound so
      JOIN shipments_outbound_items soi ON soi.shipment_id = so.id
      JOIN warehouses w ON w.id = so.origin_warehouse_id
      WHERE so.origin = 'warehouse'
        AND so.shipped_date IS NOT NULL
        AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
      GROUP BY w.id, w.name, DATE_TRUNC('month', so.shipped_date)
      ORDER BY DATE_TRUNC('month', so.shipped_date) ASC, w.name ASC
    `,
  });
}

export default getWarehouseThroughput;
