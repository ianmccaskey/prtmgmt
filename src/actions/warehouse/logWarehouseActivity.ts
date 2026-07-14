import { action } from '@uibakery/data';

/**
 * Generic warehouse activity log writer. Every inventory-affecting action
 * must write one of these rows (prompt rule). event_type / source_record_type
 * must match the table CHECK constraints.
 */
function logWarehouseActivity() {
  return action('logWarehouseActivity', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      ) VALUES (
        {{params.warehouse_id}}::bigint, NOW(), {{params.user_id}},
        {{params.event_type}},
        {{params.product_id}}, {{params.batch_id}},
        {{params.quantity_delta}},
        {{params.source_record_type}}, {{params.source_record_id}},
        {{params.notes}}
      )
      RETURNING id
    `,
  });
}

export default logWarehouseActivity;
