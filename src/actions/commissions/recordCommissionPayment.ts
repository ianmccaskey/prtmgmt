import { action } from '@uibakery/data';

function recordCommissionPayment() {
  return action('recordCommissionPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO commission_payments (
        payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, division
      ) VALUES (
        {{params.payee_type}},
        {{params.sales_rep_user_profile_id}}::bigint,
        {{params.warehouse_id}}::bigint,
        {{params.amount_usd}}::numeric,
        {{params.paid_by_user_id}}::bigint,
        {{params.note}},
        COALESCE(
          -- Only REP payments follow the rep's own division (balance math
          -- follows the rep). Expense reimbursements also carry a user id,
          -- but their division must match the operating_expenses pipeline
          -- they were incurred in — the caller's explicit division — or a
          -- china-division payee on a US expense would split the balance
          -- across divisions forever.
          CASE WHEN {{params.payee_type}} = 'sales_rep' THEN
            (SELECT up.division FROM user_profiles up WHERE up.id = {{params.sales_rep_user_profile_id}}::bigint)
          END,
          NULLIF({{params.division}}, ''), 'us')
      )
      RETURNING id
    `,
  });
}

export default recordCommissionPayment;
