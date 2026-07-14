import { action } from '@uibakery/data';

function getCOGSMargin() {
  return action('getCOGSMargin', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        SUM(soi.quantity) AS units_sold,
        SUM(soi.line_total_usd) AS revenue,
        SUM(soi.quantity * COALESCE(pb.cost_override, p.standard_cost, 0)) AS cogs,
        SUM(soi.line_total_usd) - SUM(soi.quantity * COALESCE(pb.cost_override, p.standard_cost, 0)) AS gross_margin_usd,
        CASE WHEN SUM(soi.line_total_usd) > 0
          THEN ((SUM(soi.line_total_usd) - SUM(soi.quantity * COALESCE(pb.cost_override, p.standard_cost, 0))) / SUM(soi.line_total_usd)) * 100
          ELSE 0 END AS gross_margin_pct
      FROM products p
      JOIN sales_order_items soi ON soi.product_id = p.id
      JOIN sales_orders so ON so.id = soi.sales_order_id
      LEFT JOIN sales_order_item_allocations soia ON soia.sales_order_item_id = soi.id
      LEFT JOIN product_batches pb ON pb.id = soia.batch_id
      WHERE so.status NOT IN ('cancelled')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY p.id
      ORDER BY revenue DESC
    `,
  });
}

export default getCOGSMargin;
