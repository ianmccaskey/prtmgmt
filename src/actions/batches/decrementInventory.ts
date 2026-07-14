import { action } from '@uibakery/data';

function decrementInventory() {
  return action('decrementInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inventory
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - {{params.quantity}})
      WHERE batch_id = {{params.batch_id}}
        AND warehouse_id = {{params.warehouse_id}}
    `,
  });
}

export default decrementInventory;
