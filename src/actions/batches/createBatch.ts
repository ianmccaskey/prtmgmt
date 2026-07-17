import { action } from '@uibakery/data';

function createBatch() {
  return action('createBatch', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO product_batches (
        product_id, batch_number, factory_id, manufacture_date,
        quantity_produced, net_content_mg, cost_override, qc_status, coa_url, overall_purity_pct, notes
      ) VALUES (
        {{params.product_id}}, {{params.batch_number}}, {{params.factory_id}},
        {{params.manufacture_date}}, {{params.quantity_produced}}, {{params.net_content_mg}}::numeric, {{params.cost_override}},
        {{params.qc_status}}, {{params.coa_url}}, {{params.overall_purity_pct}}, {{params.notes}}
      ) RETURNING id
    `,
  });
}

export default createBatch;
