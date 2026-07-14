import { action } from '@uibakery/data';

/**
 * Initiate a transfer in one atomic statement: transfer row + source
 * deduction + transfer_out_initiated activity log.
 */
function createTransferAtomic() {
  return action('createTransferAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH nt AS (
        INSERT INTO inter_warehouse_transfers (
          product_id, batch_id, quantity,
          source_warehouse_id, destination_warehouse_id,
          status, initiated_at, initiated_by_user_id, notes
        ) VALUES (
          {{params.product_id}}::bigint, {{params.batch_id}}::bigint, {{params.quantity}}::int,
          {{params.source_warehouse_id}}::bigint, {{params.destination_warehouse_id}}::bigint,
          'initiated', NOW(), {{params.user_id}}, {{params.notes}}
        ) RETURNING id, product_id, batch_id, source_warehouse_id, quantity
      ),
      inv AS (
        UPDATE inventory i
        SET quantity_on_hand = GREATEST(0, i.quantity_on_hand - nt.quantity)
        FROM nt
        WHERE i.product_id = nt.product_id AND i.batch_id = nt.batch_id
          AND i.warehouse_id = nt.source_warehouse_id
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT nt.source_warehouse_id, NOW(), {{params.user_id}}, 'transfer_out_initiated',
             nt.product_id, nt.batch_id, -nt.quantity, 'inter_warehouse_transfers', nt.id,
             {{params.notes}}
      FROM nt
      RETURNING source_record_id AS transfer_id
    `,
  });
}

export default createTransferAtomic;
