import { action } from '@uibakery/data';

function getRevenueByQuarter() {
  return action('getRevenueByQuarter', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        TO_CHAR(DATE_TRUNC('quarter', so.order_date), 'YYYY') || ' Q' ||
          EXTRACT(QUARTER FROM so.order_date)::text AS quarter,
        COALESCE(SUM(CASE WHEN soi.fulfillment_source = 'warehouse' THEN soi.line_total_usd ELSE 0 END), 0) AS warehouse_revenue,
        COALESCE(SUM(CASE WHEN soi.fulfillment_source = 'china_direct' THEN soi.line_total_usd ELSE 0 END), 0) AS china_direct_revenue,
        COALESCE(SUM(soi.line_total_usd), 0) AS total_revenue
      FROM sales_orders so
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      WHERE so.status NOT IN ('cancelled','quote')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY DATE_TRUNC('quarter', so.order_date), EXTRACT(QUARTER FROM so.order_date)
      ORDER BY DATE_TRUNC('quarter', so.order_date) ASC
    `,
  });
}

export default getRevenueByQuarter;
