import { action } from '@uibakery/data';

function getCommissionSummary() {
  return action('getCommissionSummary', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COALESCE(SUM(t.earned), 0) FROM (
           SELECT ROUND(SUM((so.total_usd - COALESCE(so.customer_shipping_charge_usd, 0)) * rp.commission_rate), 2) AS earned
           FROM sales_orders so
           JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
           WHERE so.sales_rep_user_profile_id IS NOT NULL AND so.status NOT IN ('cancelled','quote')
             AND rp.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
             AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
           GROUP BY so.sales_rep_user_profile_id) t
        ) AS rep_commission_earned_usd,
        (SELECT COALESCE(SUM(amount_usd), 0) FROM commission_payments
           WHERE payee_type = 'sales_rep'
             AND division = COALESCE(NULLIF({{params.division}}, ''), 'us')
             AND ({{params.date_from}} IS NULL OR paid_at::date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR paid_at::date <= {{params.date_to}}::date)
        ) AS rep_commission_paid_usd,
        (SELECT COALESCE(SUM(so.internal_shipping_cost_usd), 0)
           FROM shipments_outbound so
           WHERE so.origin = 'warehouse' AND so.internal_shipping_cost_usd IS NOT NULL
             AND COALESCE(NULLIF({{params.division}}, ''), 'us') = 'us'
             AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
        ) + (
           -- Expedited shipping fees routed to the shipping warehouse,
           -- dated by the attributed (first) shipment.
           SELECT COALESCE(SUM(f.fee), 0) FROM (
             SELECT DISTINCT ON (so3.id) so3.customer_shipping_charge_usd AS fee, sh3.shipped_date
             FROM sales_orders so3
             JOIN shipments_outbound sh3 ON sh3.sales_order_id = so3.id AND sh3.origin = 'warehouse'
             WHERE so3.shipping_fee_recipient = 'warehouse'
               AND COALESCE(so3.customer_shipping_charge_usd, 0) > 0
               AND so3.status NOT IN ('cancelled', 'quote')
             ORDER BY so3.id, sh3.id) f
           WHERE COALESCE(NULLIF({{params.division}}, ''), 'us') = 'us'
             AND ({{params.date_from}} IS NULL OR f.shipped_date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR f.shipped_date <= {{params.date_to}}::date)
        ) AS warehouse_commission_earned_usd,
        (SELECT COALESCE(SUM(amount_usd), 0) FROM commission_payments
           WHERE payee_type = 'warehouse'
             AND COALESCE(NULLIF({{params.division}}, ''), 'us') = 'us'
             AND ({{params.date_from}} IS NULL OR paid_at::date >= {{params.date_from}}::date)
             AND ({{params.date_to}} IS NULL OR paid_at::date <= {{params.date_to}}::date)
        ) AS warehouse_commission_paid_usd
    `,
  });
}

export default getCommissionSummary;
