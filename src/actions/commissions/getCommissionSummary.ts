import { action } from '@uibakery/data';

function getCommissionSummary() {
  return action('getCommissionSummary', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COALESCE(SUM(so.total_usd * 0.10), 0)
           FROM sales_orders so
           WHERE so.sales_rep_user_profile_id IS NOT NULL AND so.status <> 'cancelled'
             AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
        ) AS rep_commission_earned_usd,
        (SELECT COALESCE(SUM(amount_usd), 0) FROM commission_payments
           WHERE payee_type = 'sales_rep'
             AND ({{params.date_from}} IS NULL OR paid_at::date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR paid_at::date <= {{params.date_to}}::date)
        ) AS rep_commission_paid_usd,
        (SELECT COALESCE(SUM(so.internal_shipping_cost_usd), 0)
           FROM shipments_outbound so
           WHERE so.origin = 'warehouse' AND so.internal_shipping_cost_usd IS NOT NULL
             AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
        ) AS warehouse_commission_earned_usd,
        (SELECT COALESCE(SUM(amount_usd), 0) FROM commission_payments
           WHERE payee_type = 'warehouse'
             AND ({{params.date_from}} IS NULL OR paid_at::date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR paid_at::date <= {{params.date_to}}::date)
        ) AS warehouse_commission_paid_usd
    `,
  });
}

export default getCommissionSummary;
