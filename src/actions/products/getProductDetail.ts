import { action } from '@uibakery/data';

function getProductDetail() {
  return action('getProductDetail', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.*,
        f.name AS factory_name,
        COALESCE(SUM(i.quantity_on_hand), 0) AS total_stock,
        COALESCE(SUM(i.quantity_on_hand) - SUM(i.quantity_reserved), 0) AS total_available,
        (SELECT COUNT(*) FROM product_batches pb WHERE pb.product_id = p.id) AS batch_count
      FROM products p
      LEFT JOIN factories f ON f.id = p.factory_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.id = {{params.id}}
      GROUP BY p.id, f.name
    `,
  });
}

export default getProductDetail;
