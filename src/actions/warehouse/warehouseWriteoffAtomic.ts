import { action } from '@uibakery/data';

/**
 * Manual write-off in one atomic statement, GUARDED against reservation
 * conflicts: proceeds only when qty <= on_hand - reserved on the target row
 * (prompt rule — reps must release impacted orders first). Returns zero rows
 * when blocked; the UI surfaces which orders hold reservations.
 * Writes the writeoff record, decrements on-hand, and logs 'writeoff'.
 */
function warehouseWriteoffAtomic() {
  return action('warehouseWriteoffAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH target AS (
        SELECT id FROM inventory
        WHERE product_id = {{params.product_id}}::bigint
          AND batch_id = {{params.batch_id}}::bigint
          AND warehouse_id = {{params.warehouse_id}}::bigint
          AND quantity_on_hand - quantity_reserved >= {{params.quantity}}::int
      ),
      wo AS (
        INSERT INTO inventory_writeoffs (
          product_id, batch_id, warehouse_id, quantity, reason, notes,
          evidence_url, evidence_file, source, created_by_user_id
        )
        SELECT {{params.product_id}}::bigint, {{params.batch_id}}::bigint, {{params.warehouse_id}}::bigint,
               {{params.quantity}}::int, {{params.reason}}, {{params.notes}},
               {{params.evidence_url}}, {{params.evidence_file}}, 'manual', {{params.user_id}}
        FROM target
        RETURNING id
      ),
      inv AS (
        UPDATE inventory i
        SET quantity_on_hand = GREATEST(0, quantity_on_hand - {{params.quantity}}::int)
        FROM target t
        WHERE i.id = t.id
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT {{params.warehouse_id}}::bigint, NOW(), {{params.user_id}}, 'writeoff',
             {{params.product_id}}::bigint, {{params.batch_id}}::bigint,
             -({{params.quantity}}::int), 'inventory_writeoffs', wo.id, {{params.notes}}
      FROM wo
      RETURNING source_record_id AS writeoff_id
    `,
  });
}

export default warehouseWriteoffAtomic;
