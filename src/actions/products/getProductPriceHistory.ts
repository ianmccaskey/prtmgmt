import { action } from '@uibakery/data';

function getProductPriceHistory() {
  return action('getProductPriceHistory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        pph.id, pph.product_id, pph.field, pph.old_value, pph.new_value, pph.changed_at,
        up.display_name AS changed_by_name
      FROM product_price_history pph
      LEFT JOIN user_profiles up ON up.user_id = pph.changed_by_user_id
      WHERE pph.product_id = {{params.product_id}}
      ORDER BY pph.changed_at DESC
    `,
  });
}

export default getProductPriceHistory;
