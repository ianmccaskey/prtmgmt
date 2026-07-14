import { action } from '@uibakery/data';

/**
 * Bulk flat-$ list-price change (prompt: no % option). One atomic statement,
 * price-history rows included, floor at $0.
 * ids arrives as a Postgres array literal string, e.g. '{1,2,3}'.
 */
function bulkUpdateListPrice() {
  return action('bulkUpdateListPrice', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH targets AS (
        SELECT id, list_price FROM products
        WHERE id = ANY({{params.ids}}::bigint[])
      ),
      upd AS (
        UPDATE products p
        SET list_price = GREATEST(0, t.list_price + {{params.delta}}::numeric),
            updated_at = NOW()
        FROM targets t
        WHERE p.id = t.id
      )
      INSERT INTO product_price_history (product_id, changed_by_user_id, changed_at, field, old_value, new_value)
      SELECT t.id, {{params.user_id}}, NOW(), 'list_price', t.list_price, GREATEST(0, t.list_price + {{params.delta}}::numeric)
      FROM targets t
      WHERE t.list_price IS DISTINCT FROM GREATEST(0, t.list_price + {{params.delta}}::numeric)
      RETURNING product_id
    `,
  });
}

export default bulkUpdateListPrice;
