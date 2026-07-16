import { action } from '@uibakery/data';

function getTopProducts() {
  return action('getTopProducts', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        SUM(soi.quantity) AS units_sold,
        SUM(soi.line_total_usd) AS revenue
      FROM products p
      JOIN sales_order_items soi ON soi.product_id = p.id
      JOIN sales_orders so ON so.id = soi.sales_order_id
      WHERE so.status NOT IN ('cancelled','quote')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY p.id
      ORDER BY
        CASE WHEN {{params.sort_by}} = 'revenue' THEN SUM(soi.line_total_usd) END DESC NULLS LAST,
        CASE WHEN {{params.sort_by}} = 'units' OR {{params.sort_by}} IS NULL THEN SUM(soi.quantity) END DESC NULLS LAST
      LIMIT {{params.top_n}}
    `,
  });
}

export default getTopProducts;
