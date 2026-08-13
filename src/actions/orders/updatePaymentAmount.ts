import { action } from '@uibakery/data';

/**
 * Admin correction for a payment whose recorded amount doesn't match what
 * actually arrived on-chain (e.g. a $340 record whose TX delivered $170).
 * ONE atomic statement: updates the amount, writes the order_audit_log row
 * (old → new + caller's reason, old value read server-side so a stale
 * client can't mislog it), and re-derives the order's payment_status —
 * a correction can never exist unaudited or leave the status stale.
 *
 * Refuses (0 rows) when the payment is verified AND already counted in
 * its division's stamped settlement cycle — rewriting settled history is
 * never allowed. The division is the payment's order's rep's division
 * (no rep = us), matching every settlement query.
 *
 * Snapshot note: CTEs read the pre-update state, so the recompute
 * substitutes the NEW amount for this payment's row explicitly. The
 * status CASE mirrors recomputePaymentStatus exactly.
 *
 * Known race (accepted, same as Fix Wallet / verify-vs-settle): a
 * settlement committing in the same instant as this statement won't see
 * the correction and this guard won't see that stamp. Settlements are
 * rare and manual; if it ever happens, the carried_adjustment line in
 * Vendor Owed absorbs the cent difference into the next cycle.
 */
export function updatePaymentAmount() {
  return action('updatePaymentAmount', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH before AS (
        SELECT op.id, op.sales_order_id, op.amount_usd AS old_amount
        FROM order_payments op
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
        FOR UPDATE
      ),
      pay AS (
        UPDATE order_payments op
        SET amount_usd = {{params.amount_usd}}::numeric
        FROM before b
        WHERE op.id = b.id
        RETURNING op.id, op.sales_order_id
      ),
      audit AS (
        INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
        SELECT b.sales_order_id, {{params.userId}}::bigint, 'other', 'payment_amount',
               '$' || b.old_amount::numeric(14,2)::text,
               '$' || {{params.amount_usd}}::numeric(14,2)::text,
               'Payment #' || b.id || ' amount corrected: ' || {{params.note}}
        FROM before b
        RETURNING id
      ),
      recompute AS (
        UPDATE sales_orders so
        SET payment_status = CASE
          -- Mirrors recomputePaymentStatus: China-division orders always
          -- read 'paid' (their money lives outside the app).
          WHEN EXISTS (SELECT 1 FROM user_profiles rp2
                       WHERE rp2.id = so.sales_rep_user_profile_id
                         AND rp2.division = 'china') THEN 'paid'
          WHEN COALESCE(calc.refund_cnt, 0) > 0 AND COALESCE(calc.net, 0) <= 0 THEN 'refunded'
          WHEN COALESCE(calc.net, 0) >= so.total_usd THEN 'paid'
          WHEN COALESCE(calc.net, 0) > 0 THEN 'partial_paid'
          ELSE 'unpaid'
        END
        FROM before b
        LEFT JOIN LATERAL (
          -- Pre-update snapshot: substitute the NEW amount for the row
          -- being corrected.
          SELECT
            SUM((CASE WHEN op2.direction = 'incoming' THEN 1 ELSE -1 END)
                * (CASE WHEN op2.id = b.id THEN {{params.amount_usd}}::numeric ELSE op2.amount_usd END)) AS net,
            COUNT(*) FILTER (WHERE op2.direction = 'refund') AS refund_cnt
          FROM order_payments op2
          WHERE op2.sales_order_id = b.sales_order_id
            AND op2.verification_status = 'verified'
        ) calc ON true
        WHERE so.id = b.sales_order_id
        RETURNING so.id
      )
      SELECT b.id, b.old_amount, (SELECT COUNT(*) FROM audit)::int AS audited
      FROM before b
    `,
  });
}

export default updatePaymentAmount;
