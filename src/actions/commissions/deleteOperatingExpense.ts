import { action } from '@uibakery/data';

/**
 * Remove a mis-entered expense. Refuses (0 rows) when the PAYEE's recorded
 * reimbursements would exceed their remaining expense total — deleting
 * cover for money that was actually paid out would corrupt that user's
 * ledger (the aggregate earned-vs-paid model has no per-row link).
 *
 * An advisory transaction lock on the payee serializes concurrent deletes
 * so two of them can't jointly drop a user's incurred below reimbursed.
 * (A reimbursement inserting in the same instant is not serialized against
 * this — accepted for a single-admin manual flow; the aggregate can only
 * briefly read over-reimbursed, which never blocks anything.)
 */
function deleteOperatingExpense() {
  return action('deleteOperatingExpense', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH tgt AS (
        SELECT id, division, amount_usd, payee_user_profile_id FROM operating_expenses
        WHERE id = {{params.id}}::bigint
      ), lck AS (
        SELECT pg_advisory_xact_lock(hashtextextended(
          'opex:' || (SELECT division FROM tgt) || ':' || (SELECT payee_user_profile_id FROM tgt)::text, 0)) AS held
        FROM tgt
      )
      DELETE FROM operating_expenses oe
      USING tgt, lck
      WHERE oe.id = tgt.id
        AND (SELECT COALESCE(ROUND(SUM(o2.amount_usd), 2), 0) FROM operating_expenses o2
             WHERE o2.division = tgt.division
               AND o2.payee_user_profile_id = tgt.payee_user_profile_id) - tgt.amount_usd
            >= (SELECT COALESCE(ROUND(SUM(cp.amount_usd), 2), 0) FROM commission_payments cp
                WHERE cp.payee_type = 'expense' AND cp.division = tgt.division
                  AND cp.sales_rep_user_profile_id = tgt.payee_user_profile_id)
      RETURNING oe.id
    `,
  });
}

export default deleteOperatingExpense;
