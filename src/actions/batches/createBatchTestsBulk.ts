import { action } from '@uibakery/data';

function createBatchTestsBulk() {
  return action('createBatchTestsBulk', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO batch_tests (
        batch_id, test_type, test_date, lab_name,
        result_value, result_units, spec_min, spec_max,
        pass_fail, test_report_url, notes
      )
      SELECT
        {{params.batch_id}}::bigint,
        r.test_type,
        r.test_date,
        r.lab_name,
        r.result_value,
        r.result_units,
        r.spec_min,
        r.spec_max,
        r.pass_fail,
        r.test_report_url,
        r.notes
      FROM jsonb_to_recordset({{params.rows}}::jsonb) AS r(
        test_type TEXT,
        test_date DATE,
        lab_name TEXT,
        result_value NUMERIC(12,4),
        result_units TEXT,
        spec_min NUMERIC(12,4),
        spec_max NUMERIC(12,4),
        pass_fail TEXT,
        test_report_url TEXT,
        notes TEXT
      )
      RETURNING id
    `,
  });
}

export default createBatchTestsBulk;
