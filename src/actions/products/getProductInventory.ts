import { action } from '@uibakery/data';

function getProductInventory() {
  return action('getProductInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        i.id, i.quantity_on_hand, i.quantity_reserved,
        i.quantity_on_hand - i.quantity_reserved AS quantity_available,
        pb.batch_number, pb.qc_status, pb.manufacture_date,
        w.name AS warehouse_name, w.id AS warehouse_id,
        p.sku, p.name AS product_name
      FROM inventory i
      JOIN product_batches pb ON pb.id = i.batch_id
      JOIN warehouses w ON w.id = i.warehouse_id
      JOIN products p ON p.id = i.product_id
      WHERE i.product_id = {{params.product_id}}
      ORDER BY pb.manufacture_date ASC, w.name ASC
    `,
  });
}

export default getProductInventory;
