import { action } from '@uibakery/data';

export function getOrdersStatStrip() {
  return action('getOrdersStatStrip', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'confirmed') AS confirmed_count,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'quote') AS quote_count,
        (SELECT COUNT(*) FROM sales_orders
          WHERE status = 'shipped'
          AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)) AS shipped_this_month,
        (SELECT COALESCE(SUM(total_usd),0) FROM sales_orders
          WHERE status IN ('shipped','delivered')
          AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)) AS revenue_this_month,
        (SELECT COALESCE(SUM(so.total_usd),0) FROM sales_orders so
          WHERE so.payment_status IN ('unpaid','partial_paid')
          AND so.status NOT IN ('quote','cancelled')) AS unpaid_balance,
        (SELECT COUNT(DISTINCT soi.sales_order_id) FROM sales_order_items soi
          JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE soi.fulfillment_source = 'china_direct'
          AND so.status = 'confirmed') AS china_direct_awaiting
    `,
  });
}

export default getOrdersStatStrip;
