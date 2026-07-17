import { action } from '@uibakery/data';

function listFactoriesFull() {
  return action('listFactoriesFull', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT f.id, f.name, f.notes,
        (SELECT COUNT(*) FROM products p WHERE p.factory_id = f.id) AS product_count,
        (SELECT COUNT(*) FROM product_batches pb WHERE pb.factory_id = f.id) AS batch_count,
        (
          EXISTS(SELECT 1 FROM products p WHERE p.factory_id = f.id)
          OR EXISTS(SELECT 1 FROM product_batches pb WHERE pb.factory_id = f.id)
          OR EXISTS(SELECT 1 FROM shipments_inbound si WHERE si.factory_id = f.id)
          OR EXISTS(SELECT 1 FROM shipments_outbound so WHERE so.factory_id = f.id)
        ) AS is_used
      FROM factories f
      ORDER BY f.name ASC
    `,
  });
}
export default listFactoriesFull;
