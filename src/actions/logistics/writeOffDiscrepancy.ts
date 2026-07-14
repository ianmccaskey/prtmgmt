import { action } from '@uibakery/data';

function writeOffDiscrepancy() {
  return action('writeOffDiscrepancy', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO inventory_writeoffs (
        product_id, batch_id, warehouse_id, quantity,
        reason, notes, source, source_receipt_item_id, created_by_user_id, created_at
      ) VALUES (
        {{params.product_id}}, {{params.batch_id}}, {{params.warehouse_id}},
        {{params.quantity}},
        'receipt_discrepancy',
        {{params.notes}},
        'receipt_discrepancy',
        {{params.receipt_item_id}},
        {{params.user_id}},
        NOW()
      )
    `,
  });
}

export default writeOffDiscrepancy;
