import { action } from '@uibakery/data';

/**
 * Count correction in one atomic statement: correction record (old/new from
 * the live row) + on-hand set + count_correction activity log.
 */
function applyCorrectionAtomic() {
  return action('applyCorrectionAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH target AS (
        SELECT id, quantity_on_hand FROM inventory
        WHERE product_id = {{params.product_id}}::bigint
          AND batch_id = {{params.batch_id}}::bigint
          AND warehouse_id = {{params.warehouse_id}}::bigint
      ),
      corr AS (
        INSERT INTO inventory_count_corrections (
          product_id, batch_id, warehouse_id, old_quantity, new_quantity, reason, created_by_user_id
        )
        SELECT {{params.product_id}}::bigint, {{params.batch_id}}::bigint, {{params.warehouse_id}}::bigint,
               target.quantity_on_hand, {{params.new_quantity}}::int, {{params.reason}}, {{params.user_id}}
        FROM target
        RETURNING id, new_quantity - old_quantity AS delta
      ),
      inv AS (
        UPDATE inventory i
        SET quantity_on_hand = {{params.new_quantity}}::int
        FROM target t
        WHERE i.id = t.id
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT {{params.warehouse_id}}::bigint, NOW(), {{params.user_id}}, 'count_correction',
             {{params.product_id}}::bigint, {{params.batch_id}}::bigint,
             corr.delta, 'inventory_count_corrections', corr.id, {{params.reason}}
      FROM corr
      RETURNING source_record_id AS correction_id
    `,
  });
}

export default applyCorrectionAtomic;
