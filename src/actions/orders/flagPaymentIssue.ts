import { action } from '@uibakery/data';

export function flagPaymentIssue() {
  return action('flagPaymentIssue', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments
      SET issue_type = {{params.issueType}},
          issue_notes = {{params.issueNotes}}
      WHERE id = {{params.paymentId}}::bigint
    `,
  });
}

export default flagPaymentIssue;
