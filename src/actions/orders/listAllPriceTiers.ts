import { action } from '@uibakery/data';

/**
 * Every product's quantity price tiers, loaded once when the New Order
 * form opens — the form picks the best tier (highest min_quantity <= line
 * quantity) client-side as quantities change. Distinctly named: a previous
 * orders-side copy registered the same action name as the products page's
 * per-product query and was silently shadowed.
 */
export function listAllPriceTiers() {
  return action('listAllPriceTiers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT product_id, min_quantity, unit_price
      FROM product_price_tiers
      ORDER BY product_id, min_quantity DESC
    `,
  });
}

export default listAllPriceTiers;
