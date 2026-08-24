import { action } from '@uibakery/data';

/**
 * Per-user operating-expense balances: what each user has fronted vs been
 * reimbursed (lifetime, division-scoped). Mirrors listRepBalances' shape so
 * the Close Cycle rundown and gate treat expense payees like reps — one
 * user's overpayment must never offset another's outstanding.
 */
function listExpenseBalances() {
  return action('listExpenseBalances', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT up.id AS user_profile_id, up.display_name,
        COALESCE(e.earned, 0) AS expenses_total_usd,
        COALESCE(p.paid, 0) AS reimbursed_total_usd,
        COALESCE(e.earned, 0) - COALESCE(p.paid, 0) AS balance_owed_usd
      FROM user_profiles up
      LEFT JOIN (
        SELECT payee_user_profile_id AS uid, ROUND(SUM(amount_usd), 2) AS earned
        FROM operating_expenses
        WHERE division = COALESCE(NULLIF({{params.division}}, ''), 'us')
        GROUP BY payee_user_profile_id
      ) e ON e.uid = up.id
      LEFT JOIN (
        SELECT sales_rep_user_profile_id AS uid, ROUND(SUM(amount_usd), 2) AS paid
        FROM commission_payments
        WHERE payee_type = 'expense'
          AND division = COALESCE(NULLIF({{params.division}}, ''), 'us')
        GROUP BY sales_rep_user_profile_id
      ) p ON p.uid = up.id
      WHERE e.uid IS NOT NULL OR p.uid IS NOT NULL
      ORDER BY balance_owed_usd DESC, up.display_name
    `,
  });
}

export default listExpenseBalances;
