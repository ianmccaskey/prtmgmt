import { action } from '@uibakery/data';

function listCommissionPayments() {
  return action('listCommissionPayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        cp.id, cp.payee_type, cp.amount_usd, cp.paid_at, cp.note,
        rep.display_name AS sales_rep_name,
        w.name AS warehouse_name
      FROM commission_payments cp
      LEFT JOIN user_profiles rep ON rep.id = cp.sales_rep_user_profile_id
      LEFT JOIN warehouses w ON w.id = cp.warehouse_id
      WHERE ({{params.payee_type}} IS NULL OR cp.payee_type = {{params.payee_type}})
        AND ({{params.date_from}} IS NULL OR cp.paid_at::date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR cp.paid_at::date <= {{params.date_to}}::date)
      ORDER BY cp.paid_at DESC
    `,
  });
}

export default listCommissionPayments;
