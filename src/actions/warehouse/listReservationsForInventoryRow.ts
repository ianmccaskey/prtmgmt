import { action } from '@uibakery/data';

/** Orders holding ledgered reservations against one inventory row — shown when a write-off is blocked. */
function listReservationsForInventoryRow() {
  return action('listReservationsForInventoryRow', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT so.order_number, c.full_name AS customer_name, SUM(ir.quantity) AS reserved_qty
      FROM inventory_reservations ir
      JOIN inventory i ON i.id = ir.inventory_id
      JOIN sales_orders so ON so.id = ir.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      WHERE i.product_id = {{params.product_id}}::bigint
        AND i.batch_id = {{params.batch_id}}::bigint
        AND i.warehouse_id = {{params.warehouse_id}}::bigint
      GROUP BY so.order_number, c.full_name
      ORDER BY reserved_qty DESC
    `,
  });
}

export default listReservationsForInventoryRow;
