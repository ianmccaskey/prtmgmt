import { action } from '@uibakery/data';

export function getOrdersStatStrip() {
  return action('getOrdersStatStrip', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      -- repScope '' = global (admins/logistics); a rep id scopes every
      -- figure to that rep's own orders.
      SELECT
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'confirmed'
          AND (COALESCE({{params.repScope}}, '') = '' OR sales_rep_user_profile_id::text = {{params.repScope}})) AS confirmed_count,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'quote'
          AND (COALESCE({{params.repScope}}, '') = '' OR sales_rep_user_profile_id::text = {{params.repScope}})) AS quote_count,
        (SELECT COUNT(*) FROM sales_orders
          WHERE status = 'shipped'
          AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)
          AND (COALESCE({{params.repScope}}, '') = '' OR sales_rep_user_profile_id::text = {{params.repScope}})) AS shipped_this_month,
        (SELECT COALESCE(SUM(total_usd),0) FROM sales_orders
          WHERE status IN ('shipped','delivered')
          AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)
          AND (COALESCE({{params.repScope}}, '') = '' OR sales_rep_user_profile_id::text = {{params.repScope}})) AS revenue_this_month,
        (SELECT COALESCE(SUM(so.total_usd),0) FROM sales_orders so
          WHERE so.payment_status IN ('unpaid','partial_paid')
          AND so.status NOT IN ('quote','cancelled')
          AND (COALESCE({{params.repScope}}, '') = '' OR so.sales_rep_user_profile_id::text = {{params.repScope}})) AS unpaid_balance,
        (SELECT COUNT(DISTINCT soi.sales_order_id) FROM sales_order_items soi
          JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE soi.fulfillment_source = 'china_direct'
          AND so.status = 'confirmed'
          AND (COALESCE({{params.repScope}}, '') = '' OR so.sales_rep_user_profile_id::text = {{params.repScope}})) AS china_direct_awaiting
    `,
  });
}

export default getOrdersStatStrip;
