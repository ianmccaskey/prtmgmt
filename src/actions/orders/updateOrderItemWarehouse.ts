import { action } from '@uibakery/data';

/**
 * Set a line's fulfillment warehouse on a QUOTE, with an audit row. Quotes
 * carry no reservations, so this is purely the preference that confirm-time
 * reservation will honor. Confirmed orders are deliberately refused (0
 * rows): their per-line reallocation is the Split/Move reservations tool,
 * which moves the actual ledger entries instead of silently desyncing the
 * preference from them.
 *
 * warehouseId '' clears the line back to the order default.
 */
function updateOrderItemWarehouse() {
  return action('updateOrderItemWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH it AS (
        SELECT si.id, si.sales_order_id, si.preferred_warehouse_id AS old_wh
        FROM sales_order_items si
        JOIN sales_orders so ON so.id = si.sales_order_id
        WHERE si.id = {{params.itemId}}::bigint
          AND so.status = 'quote'
      ),
      upd AS (
        UPDATE sales_order_items si
        SET preferred_warehouse_id = NULLIF({{params.warehouseId}}, '')::bigint
        FROM it
        WHERE si.id = it.id
        RETURNING si.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
      SELECT it.sales_order_id, {{params.userId}}::bigint, NOW(), 'other', 'line_warehouse',
        COALESCE((SELECT name FROM warehouses WHERE id = it.old_wh), 'order default'),
        COALESCE((SELECT name FROM warehouses WHERE id = NULLIF({{params.warehouseId}}, '')::bigint), 'order default'),
        {{params.note}}
      FROM it
      WHERE EXISTS (SELECT 1 FROM upd)
      RETURNING sales_order_id
    `,
  });
}

export default updateOrderItemWarehouse;
