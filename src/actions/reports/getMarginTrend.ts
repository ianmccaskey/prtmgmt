import { action } from '@uibakery/data';

function getMarginTrend() {
  return action('getMarginTrend', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        TO_CHAR(DATE_TRUNC('month', so.order_date), 'YYYY-MM') AS month,
        SUM(soi.line_total_usd) AS revenue,
        SUM(soi.quantity * COALESCE(pb.cost_override, p.standard_cost, 0)) AS cogs,
        SUM(soi.line_total_usd) - SUM(soi.quantity * COALESCE(pb.cost_override, p.standard_cost, 0)) AS gross_margin
      FROM sales_orders so
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      JOIN products p ON p.id = soi.product_id
      LEFT JOIN sales_order_item_allocations soia ON soia.sales_order_item_id = soi.id
      LEFT JOIN product_batches pb ON pb.id = soia.batch_id
      WHERE so.status NOT IN ('cancelled','quote')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY DATE_TRUNC('month', so.order_date)
      ORDER BY DATE_TRUNC('month', so.order_date) ASC
    `,
  });
}

export default getMarginTrend;
