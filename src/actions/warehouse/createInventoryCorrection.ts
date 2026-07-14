import { action } from '@uibakery/data';

function createInventoryCorrection() {
  return action('createInventoryCorrection', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH current AS (
        SELECT quantity_on_hand FROM inventory
        WHERE product_id = {{params.product_id}} AND batch_id = {{params.batch_id}} AND warehouse_id = {{params.warehouse_id}}
      )
      INSERT INTO inventory_count_corrections (
        product_id, batch_id, warehouse_id,
        old_quantity, new_quantity, delta, reason, created_by_user_id, created_at
      )
      SELECT
        {{params.product_id}}, {{params.batch_id}}, {{params.warehouse_id}},
        current.quantity_on_hand, {{params.new_quantity}},
        {{params.new_quantity}} - current.quantity_on_hand,
        {{params.reason}}, {{params.user_id}}, NOW()
      FROM current
    `,
  });
}

export default createInventoryCorrection;
