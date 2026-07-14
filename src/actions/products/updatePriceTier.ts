import { action } from '@uibakery/data';

function updatePriceTier() {
  return action('updatePriceTier', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE product_price_tiers
      SET min_quantity = {{params.min_quantity}}, unit_price = {{params.unit_price}}
      WHERE id = {{params.id}}
    `,
  });
}

export default updatePriceTier;
