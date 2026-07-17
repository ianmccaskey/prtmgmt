import { action } from '@uibakery/data';

/**
 * Change a quote's fulfillment warehouse (pre-confirmation only). Setting
 * an order-level warehouse consolidates: per-line (split) assignments are
 * cleared so the two levels can't contradict each other.
 */
function updateOrderPreferredWarehouse() {
  return action('updateOrderPreferredWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE sales_orders
        SET preferred_warehouse_id = {{params.warehouseId}}::bigint
        WHERE id = {{params.orderId}}::bigint
          AND status = 'quote'
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
