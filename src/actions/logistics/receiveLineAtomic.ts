import { action } from '@uibakery/data';

/**
 * Receive one inbound line in a SINGLE atomic statement: guarded item
 * update (only while unreceived) + inventory credit + optional shortage
 * write-off + activity log + the shipment status flip. Replaces the old
 * multi-call chain, which could be interrupted mid-way and strand the
 * shipment (received line, never flipped to delivered, no UI recovery
 * path — SRY-T60-0726 sat in 'freight_forwarder' for weeks that way).
 * The flip CTE reads the pre-update snapshot, so it counts unreceived
 * lines EXCLUDING the one this statement just received. Known residual
 * (accepted): two FINAL lines received concurrently each see the other
 * as unreceived and both set in_transit — the standalone
 * flipShipmentDelivered the dialog chains afterward repairs that; the
 * dialog receives sequentially, so hitting it needs two operators plus
 * a failed follow-up.
 *
 * Empty result = the line was already received (concurrent action) — the
 * caller skips it, no side effects fire.
 */
function receiveLineAtomic() {
  return action('receiveLineAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE shipments_inbound_items
        SET quantity_received = {{params.quantity_received}}::int,
            condition_flag = {{params.condition_flag}},
            discrepancy_notes = {{params.discrepancy_notes}},
            received_at = NOW()
        WHERE id = {{params.item_id}}::bigint
          AND quantity_received IS NULL
        RETURNING id, product_id, batch_id, destination_warehouse_id, quantity_shipped
      ),
      inv AS (
        INSERT INTO inventory (product_id, batch_id, warehouse_id, quantity_on_hand)
        SELECT product_id, batch_id, destination_warehouse_id, {{params.quantity_received}}::int
        FROM upd
        WHERE {{params.quantity_received}}::int > 0
        ON CONFLICT (product_id, batch_id, warehouse_id)
        DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
      ),
      wo AS (
        INSERT INTO inventory_writeoffs (
          product_id, batch_id, warehouse_id, quantity, reason, notes,
          source, source_receipt_item_id, created_by_user_id
        )
        SELECT product_id, batch_id, destination_warehouse_id,
               quantity_shipped - {{params.quantity_received}}::int,
               'receipt_shortage', {{params.discrepancy_notes}},
               'auto_from_receipt', id, {{params.user_id}}
        FROM upd
        WHERE {{params.auto_writeoff}}::boolean
          AND quantity_shipped - {{params.quantity_received}}::int > 0
      ),
      log AS (
        INSERT INTO warehouse_activity_log (
          warehouse_id, event_at, actor_user_id, event_type,
          product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
        )
        SELECT destination_warehouse_id, NOW(), {{params.user_id}},
               CASE WHEN {{params.quantity_received}}::int < quantity_shipped OR {{params.condition_flag}} <> 'ok'
                    THEN 'receipt_discrepancy' ELSE 'receipt_delivered' END,
               product_id, batch_id, {{params.quantity_received}}::int,
               'shipments_inbound_items', id, {{params.discrepancy_notes}}
        FROM upd
      ),
      flip AS (
        UPDATE shipments_inbound si
        SET status = CASE
          -- Pre-update snapshot: other lines' state is visible, this
          -- line's isn't — exclude it from the unreceived count.
          WHEN (SELECT COUNT(*) FROM shipments_inbound_items x
                WHERE x.shipment_id = si.id
                  AND x.id <> {{params.item_id}}::bigint
                  AND x.quantity_received IS NULL) = 0
          THEN 'delivered'
          ELSE 'in_transit'
        END
        FROM upd
        WHERE si.id = (SELECT shipment_id FROM shipments_inbound_items WHERE id = upd.id)
      )
      SELECT id FROM upd
    `,
  });
}

export default receiveLineAtomic;
