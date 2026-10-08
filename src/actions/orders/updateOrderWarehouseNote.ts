import { action } from '@uibakery/data';

/**
 * Set the order's note-to-warehouse (shown in the fulfillment queue and
 * Mark Shipped). One statement: update + audit row ('' clears to NULL).
 */
function updateOrderWarehouseNote() {
  return action('updateOrderWarehouseNote', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH old AS (
        SELECT id, warehouse_note FROM sales_orders WHERE id = {{params.orderId}}::bigint
      ),
      upd AS (
        UPDATE sales_orders so SET warehouse_note = NULLIF({{params.note}}, '')
        FROM old WHERE so.id = old.id
        RETURNING so.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
      SELECT old.id, {{params.userId}}::bigint, NOW(), 'notes', 'warehouse_note',
        LEFT(COALESCE(old.warehouse_note, ''), 200), LEFT(COALESCE({{params.note}}, ''), 200),
        'Warehouse note updated'
      FROM old WHERE EXISTS (SELECT 1 FROM upd)
      RETURNING sales_order_id
    `,
  });
}

export default updateOrderWarehouseNote;
