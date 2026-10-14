import { action } from '@uibakery/data';

/**
 * Per-order commission rows, one row PER REP SHARE: a split order appears
 * once for each rep with their share percentage and their own-rate
 * commission on that share (rep_split_pct = primary's share). The
 * commission basis excludes the shipping charge (MOQ fee → vendor,
 * expedited fee → shipping warehouse).
 */
function listRepCommissionOrders() {
  return action('listRepCommissionOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT y.* FROM (
        SELECT
          so.id AS sales_order_id, so.order_number, so.order_date, so.status,
          so.total_usd,
          (so.total_usd - COALESCE(so.customer_shipping_charge_usd, 0)) * (so.rep_split_pct / 100.0) * up.commission_rate AS commission_usd,
          so.rep_split_pct AS split_pct,
          up.commission_rate,
          up.id AS sales_rep_user_profile_id, up.display_name AS sales_rep_name,
          up.division AS rep_division,
          c.full_name AS customer_name
        FROM sales_orders so
        JOIN user_profiles up ON up.id = so.sales_rep_user_profile_id
        JOIN customers c ON c.id = so.customer_id
        WHERE so.status NOT IN ('cancelled','quote')
        UNION ALL
        SELECT
          so.id, so.order_number, so.order_date, so.status,
          so.total_usd,
          (so.total_usd - COALESCE(so.customer_shipping_charge_usd, 0)) * ((100 - so.rep_split_pct) / 100.0) * up.commission_rate,
          (100 - so.rep_split_pct),
          up.commission_rate,
          up.id, up.display_name,
          up.division,
          c.full_name
        FROM sales_orders so
        JOIN user_profiles up ON up.id = so.sales_rep_user_profile_id_2
        JOIN customers c ON c.id = so.customer_id
        WHERE so.sales_rep_user_profile_id_2 IS NOT NULL AND so.status NOT IN ('cancelled','quote')
      ) y
      WHERE y.rep_division = COALESCE(NULLIF({{params.division}}, ''), 'us')
        AND ({{params.sales_rep_user_profile_id}} IS NULL OR y.sales_rep_user_profile_id = {{params.sales_rep_user_profile_id}}::bigint)
        AND ({{params.date_from}} IS NULL OR y.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR y.order_date <= {{params.date_to}}::date)
      -- order_date is day-granular — id breaks same-day ties so the list
      -- reads strictly newest-entered first.
      ORDER BY y.order_date DESC, y.sales_order_id DESC
    `,
  });
}

export default listRepCommissionOrders;
