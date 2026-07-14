import { action } from '@uibakery/data';

function logReceiptActivity() {
  return action('logReceiptActivity', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO warehouse_activity_log (
        warehouse_id, event_at, actor_user_id, event_type,
        product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
      ) VALUES (
        {{params.warehouse_id}}, NOW(), {{params.user_id}},
        {{params.event_type}},
        {{params.product_id}}, {{params.batch_id}},
        {{params.quantity_delta}},
        'shipments_inbound_items', {{params.item_id}},
        {{params.notes}}
      )
    `,
  });
}

export default logReceiptActivity;
