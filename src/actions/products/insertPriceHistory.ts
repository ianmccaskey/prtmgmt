import { action } from '@uibakery/data';

function insertPriceHistory() {
  return action('insertPriceHistory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO product_price_history (product_id, changed_by_user_id, changed_at, field, old_value, new_value)
      VALUES ({{params.product_id}}, {{params.user_id}}, NOW(), {{params.field}}, {{params.old_value}}, {{params.new_value}})
    `,
  });
}

export default insertPriceHistory;
