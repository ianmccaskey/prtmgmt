import { action } from '@uibakery/data';

function createProduct() {
  return action('createProduct', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO products (
        sku, name, description, category, vial_size_ml, vials_per_unit,
        list_price, currency, standard_cost, available_warehouse, available_china_direct,
        factory_id, is_active, low_stock_threshold, created_at, updated_at
      ) VALUES (
        {{params.sku}}, {{params.name}}, {{params.description}}, {{params.category}},
        {{params.vial_size_ml}}, {{params.vials_per_unit}},
        {{params.list_price}}, 'USD', {{params.standard_cost}},
        {{params.available_warehouse}}, {{params.available_china_direct}},
        {{params.factory_id}}, true, {{params.low_stock_threshold}},
        NOW(), NOW()
      ) RETURNING id
    `,
  });
}

export default createProduct;
