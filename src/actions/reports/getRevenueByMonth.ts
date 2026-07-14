import { action } from '@uibakery/data';

function getRevenueByMonth() {
  return action('getRevenueByMonth', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        TO_CHAR(DATE_TRUNC('month', so.order_date), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN soi.fulfillment_source = 'warehouse' THEN soi.line_total_usd ELSE 0 END), 0) AS warehouse_revenue,
        COALESCE(SUM(CASE WHEN soi.fulfillment_source = 'china_direct' THEN soi.line_total_usd ELSE 0 END), 0) AS china_direct_revenue,
        COALESCE(SUM(soi.line_total_usd), 0) AS total_revenue
      FROM sales_orders so
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      WHERE so.status NOT IN ('cancelled')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY DATE_TRUNC('month', so.order_date)
      ORDER BY DATE_TRUNC('month', so.order_date) ASC
    `,
  });
}

export default getRevenueByMonth;
