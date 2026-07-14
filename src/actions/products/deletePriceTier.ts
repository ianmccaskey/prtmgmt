import { action } from '@uibakery/data';

function deletePriceTier() {
  return action('deletePriceTier', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `DELETE FROM product_price_tiers WHERE id = {{params.id}}`,
  });
}

export default deletePriceTier;
