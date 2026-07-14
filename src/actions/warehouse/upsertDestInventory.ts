import { action } from '@uibakery/data';

function upsertDestInventory() {
  return action('upsertDestInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO inventory (product_id, batch_id, warehouse_id, quantity_on_hand, quantity_reserved)
      VALUES ({{params.product_id}}, {{params.batch_id}}, {{params.warehouse_id}}, {{params.quantity}}, 0)
      ON CONFLICT (product_id, batch_id, warehouse_id)
      DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
    `,
  });
}

export default upsertDestInventory;
