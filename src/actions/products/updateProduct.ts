import { action } from '@uibakery/data';

/**
 * Product save with the prompt's derivation rules baked in:
 * - price history rows auto-insert when list_price / standard_cost change
 * - factory_id only updates while the product has NO batches (immutable after)
 */
function updateProduct() {
  return action('updateProduct', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH old AS (
        SELECT list_price, standard_cost FROM products WHERE id = {{params.id}}::bigint
      ),
      upd AS (
        UPDATE products SET
          name = {{params.name}},
          description = {{params.description}},
          category = {{params.category}},
          vial_size_ml = {{params.vial_size_ml}},
          vials_per_unit = {{params.vials_per_unit}},
          list_price = {{params.list_price}}::numeric,
          standard_cost = COALESCE({{params.standard_cost}}::numeric, standard_cost),
          available_warehouse = {{params.available_warehouse}},
          available_china_direct = {{params.available_china_direct}},
          is_active = {{params.is_active}},
          low_stock_threshold = {{params.low_stock_threshold}},
          factory_id = CASE
            WHEN NOT EXISTS (SELECT 1 FROM product_batches pb WHERE pb.product_id = {{params.id}}::bigint)
            THEN COALESCE({{params.factory_id}}::bigint, factory_id)
            ELSE factory_id
          END,
          updated_at = NOW()
        WHERE id = {{params.id}}::bigint
        RETURNING id
      ),
      hist_lp AS (
        INSERT INTO product_price_history (product_id, changed_by_user_id, changed_at, field, old_value, new_value)
        SELECT {{params.id}}::bigint, {{params.user_id}}, NOW(), 'list_price', old.list_price, {{params.list_price}}::numeric
        FROM old WHERE old.list_price IS DISTINCT FROM {{params.list_price}}::numeric
      ),
      hist_sc AS (
        INSERT INTO product_price_history (product_id, changed_by_user_id, changed_at, field, old_value, new_value)
        SELECT {{params.id}}::bigint, {{params.user_id}}, NOW(), 'standard_cost', old.standard_cost, {{params.standard_cost}}::numeric
        FROM old
        WHERE {{params.standard_cost}} IS NOT NULL
          AND old.standard_cost IS DISTINCT FROM {{params.standard_cost}}::numeric
      )
      SELECT id FROM upd
    `,
  });
}

export default updateProduct;
