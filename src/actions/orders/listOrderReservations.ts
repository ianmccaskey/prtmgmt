import { action } from '@uibakery/data';

/** Per-product reservation totals by warehouse for one order. */
export function listOrderReservations() {
  return action('listOrderReservations', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT ir.product_id, i.warehouse_id, w.name AS warehouse_name, SUM(ir.quantity)::int AS quantity
      FROM inventory_reservations ir
      JOIN inventory i ON i.id = ir.inventory_id
      JOIN warehouses w ON w.id = i.warehouse_id
      WHERE ir.sales_order_id = {{params.orderId}}::bigint
      GROUP BY ir.product_id, i.warehouse_id, w.name
      ORDER BY ir.product_id, w.name
    `,
  });
}

export default listOrderReservations;
