import { action } from '@uibakery/data';

function getProductPriceTiers() {
  return action('getProductPriceTiers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, product_id, min_quantity, unit_price
      FROM product_price_tiers
      WHERE product_id = {{params.product_id}}
      ORDER BY min_quantity ASC
    `,
  });
}

export default getProductPriceTiers;
