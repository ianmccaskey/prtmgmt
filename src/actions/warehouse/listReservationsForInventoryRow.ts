import { action } from '@uibakery/data';

/**
 * Who holds ledgered reservations against one inventory row — orders AND
 * manual stock holds — shown when a write-off is blocked.
 */
function listReservationsForInventoryRow() {
  return action('listReservationsForInventoryRow', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        COALESCE(so.order_number, 'Manual hold') AS order_number,
        COALESCE(c.full_name,
                 COALESCE(ir.hold_reason, '') ||
                 COALESCE(' — ' || up.display_name, '')) AS customer_name,
        SUM(ir.quantity) AS reserved_qty
      FROM inventory_reservations ir
      JOIN inventory i ON i.id = ir.inventory_id
      LEFT JOIN sales_orders so ON so.id = ir.sales_order_id
      LEFT JOIN customers c ON c.id = so.customer_id
      LEFT JOIN user_profiles up ON up.id = ir.created_by_user_id
      WHERE i.product_id = {{params.product_id}}::bigint
        AND i.batch_id = {{params.batch_id}}::bigint
        AND i.warehouse_id = {{params.warehouse_id}}::bigint
      GROUP BY 1, 2
      ORDER BY reserved_qty DESC
    `,
  });
}

export default listReservationsForInventoryRow;
