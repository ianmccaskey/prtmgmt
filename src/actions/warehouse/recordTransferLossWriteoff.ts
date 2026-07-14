import { action } from '@uibakery/data';

/**
 * Record kits lost in an inter-warehouse transfer (received < sent).
 * The source deduction already happened at initiation and the missing kits
 * never reached the destination, so this records the loss (writeoff row +
 * activity log at the source warehouse) WITHOUT touching inventory counts.
 */
function recordTransferLossWriteoff() {
  return action('recordTransferLossWriteoff', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH wo AS (
        INSERT INTO inventory_writeoffs (
          product_id, batch_id, warehouse_id, quantity, reason, notes, source, created_by_user_id
        ) VALUES (
          {{params.product_id}}::bigint, {{params.batch_id}}::bigint, {{params.warehouse_id}}::bigint,
          {{params.quantity}}::int, 'lost',
          {{params.notes}},
          'manual', {{params.user_id}}
        ) RETURNING id, warehouse_id, product_id, batch_id, quantity
      )
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      )
      SELECT wo.warehouse_id, NOW(), {{params.user_id}}, 'writeoff',
             wo.product_id, wo.batch_id, -wo.quantity, 'inventory_writeoffs', wo.id,
             {{params.notes}}
      FROM wo
      RETURNING source_record_id AS writeoff_id
    `,
  });
}

export default recordTransferLossWriteoff;
