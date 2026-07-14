import { action } from '@uibakery/data';

function updateBatch() {
  return action('updateBatch', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE product_batches SET
        batch_number = {{params.batch_number}},
        manufacture_date = {{params.manufacture_date}},
        quantity_produced = {{params.quantity_produced}},
        cost_override = {{params.cost_override}},
        qc_status = {{params.qc_status}},
        coa_url = {{params.coa_url}},
        overall_purity_pct = {{params.overall_purity_pct}},
        notes = {{params.notes}}
      WHERE id = {{params.id}}
    `,
  });
}

export default updateBatch;
