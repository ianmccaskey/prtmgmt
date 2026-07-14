import { action } from '@uibakery/data';

function createBatchTest() {
  return action('createBatchTest', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO batch_tests (
        batch_id, test_type, test_date, lab_name,
        result_value, result_units, spec_min, spec_max,
        pass_fail, test_report_url, notes
      ) VALUES (
        {{params.batch_id}}, {{params.test_type}}, {{params.test_date}}, {{params.lab_name}},
        {{params.result_value}}, {{params.result_units}}, {{params.spec_min}}, {{params.spec_max}},
        {{params.pass_fail}}, {{params.test_report_url}}, {{params.notes}}
      ) RETURNING id
    `,
  });
}

export default createBatchTest;
