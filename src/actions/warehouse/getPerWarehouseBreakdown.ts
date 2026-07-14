import { action } from '@uibakery/data';

function getPerWarehouseBreakdown() {
  return action('getPerWarehouseBreakdown', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        w.id AS warehouse_id, w.name AS warehouse_name, w.city,
        COUNT(DISTINCT i.product_id) AS skus_count,
        COALESCE(SUM(i.quantity_on_hand), 0) AS total_kits,
        COALESCE(SUM(i.quantity_reserved), 0) AS reserved_kits,
        COALESCE(SUM(i.quantity_on_hand - i.quantity_reserved), 0) AS available_kits,
        COALESCE(SUM(i.quantity_on_hand * p.list_price), 0) AS retail_value
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE w.is_active = true
      GROUP BY w.id, w.name, w.city
      ORDER BY w.name ASC
    `,
  });
}

export default getPerWarehouseBreakdown;
