import { action } from '@uibakery/data';

function listProducts() {
  return action('listProducts', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.id, p.sku, p.name, p.category, p.vial_size_ml, p.vials_per_unit,
        p.list_price, p.currency, p.standard_cost,
        p.available_warehouse, p.available_china_direct,
        p.factory_id, p.is_active, p.low_stock_threshold,
        p.image_file, p.created_at, p.updated_at,
        f.name AS factory_name,
        COALESCE(SUM(i.quantity_on_hand), 0) AS total_stock,
        COALESCE(SUM(i.quantity_on_hand) - SUM(i.quantity_reserved), 0) AS total_available
      FROM products p
      LEFT JOIN factories f ON f.id = p.factory_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE
        (COALESCE({{params.search}}, '') = '' OR p.sku ILIKE {{ '%' + params.search + '%' }} OR p.name ILIKE {{ '%' + params.search + '%' }})
        AND (COALESCE({{params.category}}, '') = '' OR p.category = {{params.category}})
        AND (COALESCE({{params.factory_id}}, '') = '' OR p.factory_id::text = {{params.factory_id}})
        AND (COALESCE({{params.channel}}, '') = '' OR
             ({{params.channel}} = 'warehouse' AND p.available_warehouse = true) OR
             ({{params.channel}} = 'china_direct' AND p.available_china_direct = true))
        AND (COALESCE({{params.is_active}}, '') = '' OR p.is_active::text = {{params.is_active}})
      GROUP BY p.id, f.name
      ORDER BY p.name ASC
    `,
  });
}

export default listProducts;
