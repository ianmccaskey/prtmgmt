import { action } from '@uibakery/data';

function getBatchDetail() {
  return action('getBatchDetail', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        pb.*,
        p.sku, p.name AS product_name, p.standard_cost,
        f.name AS factory_name,
        COALESCE(SUM(i.quantity_on_hand), 0) AS qty_remaining,
        COALESCE(SUM(i.quantity_reserved), 0) AS qty_reserved
      FROM product_batches pb
      JOIN products p ON p.id = pb.product_id
      LEFT JOIN factories f ON f.id = pb.factory_id
      LEFT JOIN inventory i ON i.batch_id = pb.id
      WHERE pb.id = {{params.id}}
      GROUP BY pb.id, p.sku, p.name, p.standard_cost, f.name
    `,
  });
}

export default getBatchDetail;
