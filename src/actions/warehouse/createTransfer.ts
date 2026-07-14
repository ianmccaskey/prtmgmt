import { action } from '@uibakery/data';

function createTransfer() {
  return action('createTransfer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO inter_warehouse_transfers (
        product_id, batch_id, quantity,
        source_warehouse_id, destination_warehouse_id,
        status, initiated_at, initiated_by_user_id, notes
      ) VALUES (
        {{params.product_id}}, {{params.batch_id}}, {{params.quantity}},
        {{params.source_warehouse_id}}, {{params.destination_warehouse_id}},
        'initiated', NOW(), {{params.user_id}}, {{params.notes}}
      ) RETURNING id
    `,
  });
}

export default createTransfer;
