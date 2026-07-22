import { action } from '@uibakery/data';

/**
 * Vendor ledger, presented PER SETTLEMENT CYCLE: collections since the last
 * settlement, current rep/warehouse outstanding balances (zeroed by each
 * settlement, so they too read "since settlement"), vendor payments made
 * this cycle, and the true balance owed (lifetime formula — the exact
 * amount Settle All would pay). carried_adjustment_usd is any residue from
 * before the last settlement (overpaid payees, negative vendor share) so
 * the on-screen arithmetic always reconciles to the balance.
 */
function getVendorBalance() {
  return action('getVendorBalance', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        ls.id AS last_settlement_id,
        ls.settled_at AS last_settled_at,
        cyc.collected AS collected_usd,
        rep.outstanding AS rep_commissions_usd,
        wh.outstanding AS warehouse_earned_usd,
        (cyc.collected - rep.outstanding - wh.outstanding)::numeric(14,2) AS vendor_share_usd,
        vpc.paid AS vendor_paid_usd,
        owed.balance AS balance_owed_usd,
        (owed.balance - (cyc.collected - rep.outstanding - wh.outstanding - vpc.paid))::numeric(14,2) AS carried_adjustment_usd
      FROM (SELECT 1) x
      LEFT JOIN LATERAL (
        SELECT id, settled_at FROM settlements ORDER BY settled_at DESC LIMIT 1
      ) ls ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END), 0)::numeric(14,2) AS collected
        FROM order_payments op
        WHERE op.verification_status = 'verified'
          AND COALESCE(op.verified_at, op.quoted_at) > COALESCE(ls.settled_at, '-infinity'::timestamptz)
      ) cyc ON true
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((SELECT ROUND(SUM(total_usd * 0.10), 2) FROM sales_orders
                    WHERE sales_rep_user_profile_id IS NOT NULL AND status NOT IN ('cancelled', 'quote')), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments WHERE payee_type = 'sales_rep'), 0)
        )::numeric(14,2) AS outstanding
      ) rep ON true
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((SELECT SUM(internal_shipping_cost_usd) FROM shipments_outbound
                    WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments WHERE payee_type = 'warehouse'), 0)
        )::numeric(14,2) AS outstanding
      ) wh ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount_usd), 0)::numeric(14,2) AS paid
        FROM commission_payments
        WHERE payee_type = 'vendor' AND paid_at > COALESCE(ls.settled_at, '-infinity'::timestamptz)
      ) vpc ON true
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((SELECT SUM(CASE WHEN direction = 'refund' THEN -amount_usd ELSE amount_usd END)
                    FROM order_payments WHERE verification_status = 'verified'), 0)
          - COALESCE((SELECT ROUND(SUM(total_usd * 0.10), 2) FROM sales_orders
                      WHERE sales_rep_user_profile_id IS NOT NULL AND status NOT IN ('cancelled', 'quote')), 0)
          - COALESCE((SELECT SUM(internal_shipping_cost_usd) FROM shipments_outbound
                      WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments WHERE payee_type = 'vendor'), 0)
        )::numeric(14,2) AS balance
      ) owed ON true
    `,
  });
}

export default getVendorBalance;
