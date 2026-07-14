import { action } from '@uibakery/data';

export function getRevenueByMonth() {
  return action('getRevenueByMonthHome', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        TO_CHAR(DATE_TRUNC('month', order_date), 'Mon YY') AS month_label,
        DATE_TRUNC('month', order_date) AS month_date,
        COALESCE(SUM(CASE WHEN EXISTS (
          SELECT 1 FROM sales_order_items soi
          WHERE soi.sales_order_id = so.id AND soi.fulfillment_source = 'warehouse'
        ) THEN total_usd ELSE 0 END), 0) AS warehouse_revenue,
        COALESCE(SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM sales_order_items soi
          WHERE soi.sales_order_id = so.id AND soi.fulfillment_source = 'warehouse'
        ) THEN total_usd ELSE 0 END), 0) AS china_revenue,
        COALESCE(SUM(total_usd), 0) AS total_revenue
      FROM sales_orders so
      WHERE status IN ('shipped','delivered')
        AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', order_date)
      ORDER BY month_date ASC
    `,
  });
}

export default getRevenueByMonth;
