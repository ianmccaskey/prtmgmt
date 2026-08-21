import { action } from '@uibakery/data';

/**
 * Remove a mis-entered expense. Refuses (0 rows) when reimbursements
 * already recorded would exceed the remaining expense total — deleting
 * cover for money that was actually paid out would corrupt the ledger
 * (the aggregate earned-vs-paid model has no per-row link to protect).
 */
function deleteOperatingExpense() {
  return action('deleteOperatingExpense', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM operating_expenses oe
      WHERE oe.id = {{params.id}}::bigint
        AND (SELECT COALESCE(SUM(o2.amount_usd), 0) FROM operating_expenses o2
             WHERE o2.division = oe.division) - oe.amount_usd
            >= (SELECT COALESCE(SUM(cp.amount_usd), 0) FROM commission_payments cp
                WHERE cp.payee_type = 'expense' AND cp.division = oe.division)
      RETURNING id
    `,
  });
}

export default deleteOperatingExpense;
