import { action } from '@uibakery/data';

/**
 * Change an order's fulfillment warehouse while it's still unshipped
 * (quote or confirmed — the drawer re-targets a confirmed order's
 * reservations right after). Setting an order-level warehouse
 * consolidates: per-line (split) assignments are cleared so the two
 * levels can't contradict each other.
 */
function updateOrderPreferredWarehouse() {
  return action('updateOrderPreferredWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE sales_orders
        SET preferred_warehouse_id = {{params.warehouseId}}::bigint
        WHERE id = {{params.orderId}}::bigint
          AND status IN ('quote', 'confirmed')
        RETURNING id
      )
      UPDATE sales_order_items soi
      SET preferred_warehouse_id = NULL
      FROM upd
      WHERE soi.sales_order_id = upd.id
      RETURNING soi.sales_order_id AS id
    `,
  });
}
export default updateOrderPreferredWarehouse;
