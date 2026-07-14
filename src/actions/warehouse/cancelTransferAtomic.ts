import { action } from '@uibakery/data';

/**
 * Cancel an initiated transfer atomically: status flip (guarded) + restore
 * the source warehouse's on-hand + transfer_cancelled activity log.
 */
function cancelTransferAtomic() {
  return action('cancelTransferAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH t AS (
        UPDATE inter_warehouse_transfers iwt
        SET status = 'cancelled', notes = COALESCE({{params.notes}}, iwt.notes)
        WHERE iwt.id = {{params.id}}::bigint AND iwt.status = 'initiated'
        RETURNING iwt.id, iwt.product_id, iwt.batch_id, iwt.source_warehouse_id, iwt.quantity
      ),
      inv AS (
        UPDATE inventory i
        SET quantity_on_hand = i.quantity_on_hand + t.quantity
        FROM t
        WHERE i.product_id = t.product_id AND i.batch_id = t.batch_id
          AND i.warehouse_id = t.source_warehouse_id
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT t.source_warehouse_id, NOW(), {{params.user_id}}, 'transfer_cancelled',
             t.product_id, t.batch_id, t.quantity, 'inter_warehouse_transfers', t.id,
             {{params.notes}}
      FROM t
      RETURNING source_record_id AS transfer_id
    `,
  });
}

export default cancelTransferAtomic;
