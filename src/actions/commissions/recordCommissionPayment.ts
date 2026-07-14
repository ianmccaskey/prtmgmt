import { action } from '@uibakery/data';

function recordCommissionPayment() {
  return action('recordCommissionPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO commission_payments (
        payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note
      ) VALUES (
        {{params.payee_type}},
        {{params.sales_rep_user_profile_id}}::bigint,
        {{params.warehouse_id}}::bigint,
        {{params.amount_usd}}::numeric,
        {{params.paid_by_user_id}}::bigint,
        {{params.note}}
      )
      RETURNING id
    `,
  });
}

export default recordCommissionPayment;
