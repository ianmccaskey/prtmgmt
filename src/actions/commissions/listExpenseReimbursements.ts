import { action } from '@uibakery/data';

/** Expense reimbursements paid out, newest first. */
function listExpenseReimbursements() {
  return action('listExpenseReimbursements', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT cp.id, cp.amount_usd, cp.paid_at, cp.note, cp.tx_hash, up.display_name AS paid_by,
        payee.display_name AS payee_name
      FROM commission_payments cp
      LEFT JOIN user_profiles payee ON payee.id = cp.sales_rep_user_profile_id
      LEFT JOIN user_profiles up ON up.id = cp.paid_by_user_id
      WHERE cp.payee_type = 'expense'
        AND cp.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
      ORDER BY cp.paid_at DESC
    `,
  });
}

export default listExpenseReimbursements;
