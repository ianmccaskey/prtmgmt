import { action } from '@uibakery/data';

function getBatchInventory() {
  return action('getBatchInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        i.id, i.quantity_on_hand, i.quantity_reserved,
        i.quantity_on_hand - i.quantity_reserved AS quantity_available,
        w.name AS warehouse_name, w.id AS warehouse_id
      FROM inventory i
      JOIN warehouses w ON w.id = i.warehouse_id
      WHERE i.batch_id = {{params.batch_id}}
      ORDER BY w.name ASC
    `,
  });
}

export default getBatchInventory;
