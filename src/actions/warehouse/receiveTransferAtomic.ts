import { action } from '@uibakery/data';

/**
 * Receive a transfer in one atomic statement: status flip (guarded to
 * 'initiated' so double-clicks are no-ops) + destination inventory upsert of
 * the RECEIVED quantity + transfer_in_received activity log. A short receipt
 * stamps a discrepancy note onto the transfer.
 */
function receiveTransferAtomic() {
  return action('receiveTransferAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH t AS (
        UPDATE inter_warehouse_transfers iwt
        SET status = 'received', received_at = NOW(), received_by_user_id = {{params.user_id}},
            notes = CASE
              WHEN {{params.received_quantity}}::int < iwt.quantity
              THEN TRIM(BOTH ' | ' FROM COALESCE(iwt.notes, '') || ' | DISCREPANCY: received ' || {{params.received_quantity}}::int || ' of ' || iwt.quantity || ' kits. ' || COALESCE({{params.notes}}, ''))
              ELSE COALESCE({{params.notes}}, iwt.notes)
            END
        WHERE iwt.id = {{params.id}}::bigint AND iwt.status = 'initiated'
        RETURNING iwt.id, iwt.product_id, iwt.batch_id, iwt.destination_warehouse_id, iwt.quantity
      ),
      inv AS (
        INSERT INTO inventory (product_id, batch_id, warehouse_id, quantity_on_hand, quantity_reserved)
        SELECT t.product_id, t.batch_id, t.destination_warehouse_id, {{params.received_quantity}}::int, 0 FROM t
        ON CONFLICT (product_id, batch_id, warehouse_id)
        DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT t.destination_warehouse_id, NOW(), {{params.user_id}}, 'transfer_in_received',
             t.product_id, t.batch_id, {{params.received_quantity}}::int, 'inter_warehouse_transfers', t.id,
             CASE WHEN {{params.received_quantity}}::int < t.quantity
                  THEN 'Received short: ' || {{params.received_quantity}}::int || ' of ' || t.quantity
                  ELSE NULL END
      FROM t
      RETURNING source_record_id AS transfer_id
    `,
  });
}

export default receiveTransferAtomic;
