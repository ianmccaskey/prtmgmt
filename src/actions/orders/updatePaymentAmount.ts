import { action } from '@uibakery/data';

/**
 * Admin correction for a payment whose recorded amount doesn't match what
 * actually arrived on-chain (e.g. a $340 record whose TX delivered $170).
 * The correction itself carries no history — callers MUST audit-log
 * old → new with the reason, and chain recomputePaymentStatus so the
 * order's payment status re-derives honestly.
 *
 * Refuses (0 rows) when the payment is verified AND already counted in
 * its division's stamped settlement cycle — rewriting settled history is
 * never allowed. The division is the payment's order's rep's division
 * (no rep = us), matching every settlement query.
 */
export function updatePaymentAmount() {
  return action('updatePaymentAmount', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments op
      SET amount_usd = {{params.amount_usd}}::numeric
      WHERE op.id = {{params.paymentId}}::bigint
        AND {{params.amount_usd}}::numeric > 0
        AND (op.verification_status <> 'verified'
             OR op.verified_at > COALESCE((
                  SELECT MAX(s.settled_at) FROM settlements s
                  WHERE s.division = (
                    SELECT COALESCE(rp.division, 'us')
                    FROM sales_orders so2
                    LEFT JOIN user_profiles rp ON rp.id = so2.sales_rep_user_profile_id
                    WHERE so2.id = op.sales_order_id)
                ), '-infinity'::timestamptz))
      RETURNING op.id, op.amount_usd
    `,
  });
}

export default updatePaymentAmount;
