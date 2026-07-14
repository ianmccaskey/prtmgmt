import { action } from '@uibakery/data';

function listBatchTests() {
  return action('listBatchTests', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        bt.id, bt.batch_id, bt.test_type, bt.test_date, bt.lab_name,
        bt.result_value, bt.result_units, bt.spec_min, bt.spec_max,
        bt.pass_fail, bt.test_report_url, bt.notes
      FROM batch_tests bt
      WHERE bt.batch_id = {{params.batch_id}}
        AND (COALESCE({{params.test_type}}, '') = '' OR bt.test_type = {{params.test_type}})
      ORDER BY bt.test_date DESC
    `,
  });
}

export default listBatchTests;
