import { action } from '@uibakery/data';

/** Operating expenses (lifetime), newest first. */
function listOperatingExpenses() {
  return action('listOperatingExpenses', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT oe.id, oe.expense_date, oe.category, oe.description, oe.amount_usd,
        oe.payee_user_profile_id, payee.display_name AS payee_name,
        up.display_name AS created_by, oe.created_at
      FROM operating_expenses oe
      LEFT JOIN user_profiles payee ON payee.id = oe.payee_user_profile_id
      LEFT JOIN user_profiles up ON up.id = oe.created_by_user_id
      WHERE oe.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
      ORDER BY oe.expense_date DESC, oe.id DESC
    `,
  });
}

export default listOperatingExpenses;
