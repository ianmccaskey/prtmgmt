import { action } from '@uibakery/data';

/**
 * Delete a factory — only when nothing references it (products, batches,
 * inbound or outbound shipments). Empty result = blocked.
 */
function deleteFactory() {
  return action('deleteFactory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM factories f
      WHERE f.id = {{params.id}}::bigint
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.factory_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM product_batches pb WHERE pb.factory_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM shipments_inbound si WHERE si.factory_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM shipments_outbound so WHERE so.factory_id = f.id)
      RETURNING f.id
    `,
  });
}
export default deleteFactory;
