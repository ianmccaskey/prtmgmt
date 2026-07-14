import { action } from '@uibakery/data';

export function getProductPriceTiers() {
  return action('getProductPriceTiers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT min_quantity, unit_price
      FROM product_price_tiers
      WHERE product_id = {{params.productId}}::bigint
      ORDER BY min_quantity DESC
    `,
  });
}

export default getProductPriceTiers;
