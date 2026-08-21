import { action } from '@uibakery/data';

/**
 * Remove a mis-entered expense. Refuses (0 rows) when reimbursements
 * already recorded would exceed the remaining expense total — deleting
 * cover for money that was actually paid out would corrupt the ledger
 * (the aggregate earned-vs-paid model has no per-row link to protect).
 *
 * An advisory transaction lock on the division serializes concurrent
 * deletes so two of them can't both pass the aggregate check and jointly
 * drop incurred below reimbursed. (A reimbursement inserting in the same
 * instant is not serialized against this — accepted for a single-admin
 * manual flow; the aggregate can only briefly read over-reimbursed, which
 * never blocks anything.)
 */
function deleteOperatingExpense() {
  return action('deleteOperatingExpense', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH tgt AS (
        SELECT id, division, amount_usd FROM operating_expenses
        WHERE id = {{params.id}}::bigint
      ), lck AS (
        SELECT pg_advisory_xact_lock(hashtextextended('opex:' || (SELECT division FROM tgt), 0)) AS held
        FROM tgt
      )
      DELETE FROM operating_expenses oe
      USING tgt, lck
      WHERE oe.id = tgt.id
        AND (SELECT COALESCE(ROUND(SUM(o2.amount_usd), 2), 0) FROM operating_expenses o2
             WHERE o2.division = tgt.division) - tgt.amount_usd
            >= (SELECT COALESCE(ROUND(SUM(cp.amount_usd), 2), 0) FROM commission_payments cp
                WHERE cp.payee_type = 'expense' AND cp.division = tgt.division)
      RETURNING oe.id
    `,
  });
}

export default deleteOperatingExpense;
