import { action } from '@uibakery/data';

function upsertPriceTier() {
  return action('upsertPriceTier', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO product_price_tiers (product_id, min_quantity, unit_price)
      VALUES ({{params.product_id}}, {{params.min_quantity}}, {{params.unit_price}})
      ON CONFLICT (id) DO UPDATE SET min_quantity = EXCLUDED.min_quantity, unit_price = EXCLUDED.unit_price
      RETURNING id
    `,
  });
}

export default upsertPriceTier;
