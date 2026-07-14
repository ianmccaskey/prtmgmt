import { action } from '@uibakery/data';

function applyInventoryCorrection() {
  return action('applyInventoryCorrection', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inventory
      SET quantity_on_hand = {{params.new_quantity}}
      WHERE product_id = {{params.product_id}} AND batch_id = {{params.batch_id}} AND warehouse_id = {{params.warehouse_id}}
    `,
  });
}

export default applyInventoryCorrection;
