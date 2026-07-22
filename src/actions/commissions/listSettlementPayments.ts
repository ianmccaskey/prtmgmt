import { action } from '@uibakery/data';

/** Every payout recorded by one settlement: reps, warehouses, vendor. */
function listSettlementPayments() {
  return action('listSettlementPayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT cp.id, cp.payee_type, cp.amount_usd, cp.paid_at,
        rep.display_name AS sales_rep_name,
        w.name AS warehouse_name
      FROM commission_payments cp
      LEFT JOIN user_profiles rep ON rep.id = cp.sales_rep_user_profile_id
      LEFT JOIN warehouses w ON w.id = cp.warehouse_id
      WHERE cp.settlement_id = {{params.settlement_id}}::bigint
      ORDER BY CASE cp.payee_type WHEN 'sales_rep' THEN 1 WHEN 'warehouse' THEN 2 ELSE 3 END, cp.amount_usd DESC
    `,
  });
}

export default listSettlementPayments;
