import { action } from '@uibakery/data';

function deductSourceInventory() {
  return action('deductSourceInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inventory
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - {{params.quantity}})
      WHERE product_id = {{params.product_id}}
        AND batch_id = {{params.batch_id}}
        AND warehouse_id = {{params.warehouse_id}}
    `,
  });
}

export default deductSourceInventory;
