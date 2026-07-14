import { action } from '@uibakery/data';

function getRevenueKPIs() {
  return action('getRevenueKPIs', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH current_period AS (
        SELECT
          COALESCE(SUM(soi.line_total_usd), 0) AS total_revenue,
          COUNT(DISTINCT so.id) AS order_count,
          COUNT(DISTINCT DATE_TRUNC('month', so.order_date)) AS months_count
        FROM sales_orders so
        JOIN sales_order_items soi ON soi.sales_order_id = so.id
        WHERE so.status NOT IN ('cancelled')
          AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
          AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      ),
      prior_period AS (
        SELECT COALESCE(SUM(soi.line_total_usd), 0) AS total_revenue
        FROM sales_orders so
        JOIN sales_order_items soi ON soi.sales_order_id = so.id
        WHERE so.status NOT IN ('cancelled')
          AND ({{params.prior_from}} IS NULL OR so.order_date >= {{params.prior_from}}::date)
          AND ({{params.prior_to}} IS NULL OR so.order_date < {{params.date_from}}::date)
      )
      SELECT
        c.total_revenue,
        c.order_count,
        CASE WHEN c.months_count > 0 THEN c.total_revenue / c.months_count ELSE 0 END AS avg_monthly_revenue,
        p.total_revenue AS prior_revenue,
        CASE WHEN p.total_revenue > 0 THEN ((c.total_revenue - p.total_revenue) / p.total_revenue) * 100 ELSE NULL END AS growth_pct
      FROM current_period c, prior_period p
    `,
  });
}

export default getRevenueKPIs;
