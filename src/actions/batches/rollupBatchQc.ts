import { action } from '@uibakery/data';

/**
 * Derive product_batches.qc_status from the newest HPLC purity and newest
 * mass-spec tests (prompt rule): both pass → passed, any fail → failed,
 * either missing/marginal → pending. Manual quarantine takes precedence and
 * is never overwritten here. Also denormalizes overall_purity_pct from the
 * newest HPLC result.
 */
function rollupBatchQc() {
  return action('rollupBatchQc', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH latest AS (
        SELECT
          (SELECT pass_fail FROM batch_tests
            WHERE batch_id = {{params.batch_id}}::bigint AND test_type = 'hplc_purity'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS hplc_pf,
          (SELECT result_value FROM batch_tests
            WHERE batch_id = {{params.batch_id}}::bigint AND test_type = 'hplc_purity'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS hplc_value,
          (SELECT pass_fail FROM batch_tests
            WHERE batch_id = {{params.batch_id}}::bigint AND test_type = 'mass_spec'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS ms_pf
      )
      UPDATE product_batches pb
      SET qc_status = CASE
            WHEN pb.qc_status = 'quarantine' THEN pb.qc_status
            WHEN latest.hplc_pf = 'fail' OR latest.ms_pf = 'fail' THEN 'failed'
            WHEN latest.hplc_pf = 'pass' AND latest.ms_pf = 'pass' THEN 'passed'
            ELSE 'pending'
          END,
          overall_purity_pct = COALESCE(latest.hplc_value, pb.overall_purity_pct)
      FROM latest
      WHERE pb.id = {{params.batch_id}}::bigint
      RETURNING pb.id, pb.qc_status, pb.overall_purity_pct
    `,
  });
}

export default rollupBatchQc;
