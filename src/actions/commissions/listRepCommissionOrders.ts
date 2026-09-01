import { action } from '@uibakery/data';

function listRepCommissionOrders() {
  return action('listRepCommissionOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS sales_order_id, so.order_number, so.order_date, so.status,
        so.total_usd, so.total_usd * up.commission_rate AS commission_usd,
        up.commission_rate,
        up.id AS sales_rep_user_profile_id, up.display_name AS sales_rep_name,
        c.full_name AS customer_name
      FROM sales_orders so
      JOIN user_profiles up ON up.id = so.sales_rep_user_profile_id
      JOIN customers c ON c.id = so.customer_id
      WHERE up.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
        AND ({{params.sales_rep_user_profile_id}} IS NULL OR up.id = {{params.sales_rep_user_profile_id}}::bigint)
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
        AND so.status NOT IN ('cancelled','quote')
      -- order_date is day-granular — id breaks same-day ties so the list
      -- reads strictly newest-entered first.
      ORDER BY so.order_date DESC, so.id DESC
    `,
  });
}

export default listRepCommissionOrders;
