import { action } from '@uibakery/data';

/**
 * Active manual stock holds (reservation ledger rows with no order),
 * optionally scoped to one warehouse ('' = all) — matching the Inventory
 * tab's warehouse filter semantics.
 */
export function listStockHolds() {
  return action('listStockHolds', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT r.id, r.quantity, r.hold_reason, r.created_at,
        up.display_name AS created_by,
        p.name AS product_name, p.sku,
        b.batch_number, w.name AS warehouse_name
      FROM inventory_reservations r
      JOIN inventory i ON i.id = r.inventory_id
      JOIN products p ON p.id = r.product_id
      JOIN product_batches b ON b.id = i.batch_id
      JOIN warehouses w ON w.id = i.warehouse_id
      LEFT JOIN user_profiles up ON up.id = r.created_by_user_id
      WHERE r.sales_order_id IS NULL
        AND (COALESCE({{params.warehouse_id}}, '') = '' OR w.id::text = {{params.warehouse_id}})
      ORDER BY r.created_at DESC
    `,
  });
}

export default listStockHolds;
