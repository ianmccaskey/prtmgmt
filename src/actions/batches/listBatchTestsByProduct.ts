import { action } from '@uibakery/data';

function listBatchTestsByProduct() {
  return action('listBatchTestsByProduct', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        bt.id, bt.batch_id, bt.test_type, bt.test_date, bt.lab_name,
        bt.result_value, bt.result_units, bt.spec_min, bt.spec_max,
        bt.pass_fail, bt.test_report_url, bt.notes,
        pb.batch_number, pb.manufacture_date
      FROM batch_tests bt
      JOIN product_batches pb ON pb.id = bt.batch_id
      WHERE pb.product_id = {{params.product_id}}
        AND (COALESCE({{params.test_type}}, '') = '' OR bt.test_type = {{params.test_type}})
      ORDER BY bt.test_date DESC
    `,
  });
}

export default listBatchTestsByProduct;
