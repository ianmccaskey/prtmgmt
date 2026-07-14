import { action } from '@uibakery/data';

function markTransferReceived() {
  return action('markTransferReceived', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inter_warehouse_transfers
      SET status = 'received', received_at = NOW(), received_by_user_id = {{params.user_id}},
          notes = COALESCE({{params.notes}}, notes)
      WHERE id = {{params.id}}
    `,
  });
}

export default markTransferReceived;
