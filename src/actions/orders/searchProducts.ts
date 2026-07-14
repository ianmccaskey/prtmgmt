import { action } from '@uibakery/data';

export function searchProducts() {
  return action('searchProducts', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.id, p.sku, p.name, p.list_price, p.available_warehouse, p.available_china_direct,
        COALESCE(SUM(i.quantity_on_hand - i.quantity_reserved), 0) AS available_stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = true
        AND (
          COALESCE(params.q, '') = ''
          OR p.sku ILIKE {{ '%' + params.q + '%' }}
          OR p.name ILIKE {{ '%' + params.q + '%' }}
        )
      GROUP BY p.id
      ORDER BY p.name
      LIMIT 50
    `,
  });
}

export default searchProducts;
