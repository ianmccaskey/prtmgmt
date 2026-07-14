import { action } from '@uibakery/data';

function updateProduct() {
  return action('updateProduct', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE products SET
        name = {{params.name}},
        description = {{params.description}},
        category = {{params.category}},
        vial_size_ml = {{params.vial_size_ml}},
        vials_per_unit = {{params.vials_per_unit}},
        list_price = {{params.list_price}},
        standard_cost = {{params.standard_cost}},
        available_warehouse = {{params.available_warehouse}},
        available_china_direct = {{params.available_china_direct}},
        is_active = {{params.is_active}},
        low_stock_threshold = {{params.low_stock_threshold}},
        updated_at = NOW()
      WHERE id = {{params.id}}
    `,
  });
}

export default updateProduct;
