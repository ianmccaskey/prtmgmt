import { action } from '@uibakery/data';

function addPriceTier() {
  return action('addPriceTier', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO product_price_tiers (product_id, min_quantity, unit_price)
      VALUES ({{params.product_id}}, {{params.min_quantity}}, {{params.unit_price}})
      RETURNING id
    `,
  });
}

export default addPriceTier;
