import { action } from '@uibakery/data';

export function flagShipmentIssue() {
  return action('flagShipmentIssue', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_outbound
      SET issue_flag = {{params.issueFlag}},
          issue_notes = {{params.issueNotes}},
          issue_flagged_at = NOW(),
          issue_flagged_by_user_id = {{params.userId}}
      WHERE id = {{params.shipmentId}}::bigint
    `,
  });
}

export default flagShipmentIssue;
