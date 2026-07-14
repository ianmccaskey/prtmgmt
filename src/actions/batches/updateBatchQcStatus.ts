import { action } from '@uibakery/data';

function updateBatchQcStatus() {
  return action('updateBatchQcStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE product_batches
      SET qc_status = {{params.qc_status}}, notes = COALESCE({{params.notes}}, notes)
      WHERE id = {{params.id}}
    `,
  });
}

export default updateBatchQcStatus;
