import { action } from '@uibakery/data';

function createWarehouseWriteoff() {
  return action('createWarehouseWriteoff', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO inventory_writeoffs (
        product_id, batch_id, warehouse_id, quantity,
        reason, notes, evidence_url, source, created_by_user_id, created_at
      ) VALUES (
        {{params.product_id}}, {{params.batch_id}}, {{params.warehouse_id}},
        {{params.quantity}}, {{params.reason}}, {{params.notes}},
        {{params.evidence_url}}, 'manual_writeoff', {{params.user_id}}, NOW()
      )
    `,
  });
}

export default createWarehouseWriteoff;
