import { action } from '@uibakery/data';

function listWarehousePayables() {
  return action('listWarehousePayables', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        w.id AS warehouse_id, w.name AS warehouse_name,
        COUNT(so.id) AS owed_shipments_count,
        COALESCE(SUM(so.internal_shipping_cost_usd), 0) AS owed_usd_total
      FROM shipments_outbound so
      JOIN warehouses w ON w.id = so.origin_warehouse_id
      WHERE so.payable_status = 'owed' AND so.origin = 'warehouse'
        AND (COALESCE({{params.warehouse_id}}, '') = '' OR so.origin_warehouse_id::text = {{params.warehouse_id}})
      GROUP BY w.id, w.name
      ORDER BY owed_usd_total DESC
    `,
  });
}

export default listWarehousePayables;
