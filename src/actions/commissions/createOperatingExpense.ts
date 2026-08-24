import { action } from '@uibakery/data';

/** Record one operator-fronted cost to be reimbursed at settlement. */
function createOperatingExpense() {
  return action('createOperatingExpense', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO operating_expenses (
        expense_date, category, description, amount_usd, division, created_by_user_id, payee_user_profile_id
      ) VALUES (
        COALESCE(NULLIF({{params.expense_date}}, '')::date, CURRENT_DATE),
        COALESCE(NULLIF({{params.category}}, ''), 'other'),
        {{params.description}},
        ROUND({{params.amount_usd}}::numeric, 2),
        COALESCE(NULLIF({{params.division}}, ''), 'us'),
        {{params.created_by_user_id}}::bigint,
        {{params.payee_user_profile_id}}::bigint
      )
      RETURNING id
    `,
  });
}

export default createOperatingExpense;
