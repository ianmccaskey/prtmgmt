import { action } from '@uibakery/data';

/**
 * Vendor ledger for ONE division (us | china), presented PER SETTLEMENT
 * CYCLE of that division: collections since the division's last
 * settlement, current in-division rep outstanding (warehouses US-only),
 * vendor payments made this cycle, and the true balance owed (lifetime
 * formula — the amount a division Settle All would pay when positive;
 * a negative balance is a shortfall that Settle All stamps as 0 and
 * carries forward).
 * carried_adjustment_usd is any residue from before the last settlement
 * (overpaid payees, negative vendor share) so the on-screen arithmetic
 * always reconciles to the balance. A payment's division is its order's
 * rep's division (no rep = us). Must mirror executeSettlementAtomic.
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
        exp.outstanding AS expenses_usd,
        (cyc.collected - rep.outstanding - wh.outstanding - exp.outstanding)::numeric(14,2) AS vendor_share_usd,
        vpc.paid AS vendor_paid_usd,
        owed.balance AS balance_owed_usd,
        (owed.balance - (cyc.collected - rep.outstanding - wh.outstanding - exp.outstanding - vpc.paid))::numeric(14,2) AS carried_adjustment_usd
      FROM (SELECT COALESCE(NULLIF({{params.division}}, ''), 'us') AS d) div
      LEFT JOIN LATERAL (
        SELECT id, settled_at FROM settlements
        WHERE division = div.d
        ORDER BY settled_at DESC LIMIT 1
      ) ls ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END), 0)::numeric(14,2) AS collected
        FROM order_payments op
        JOIN sales_orders so2 ON so2.id = op.sales_order_id
        LEFT JOIN user_profiles orp ON orp.id = so2.sales_rep_user_profile_id
        WHERE op.verification_status = 'verified'
          AND COALESCE(orp.division, 'us') = div.d
          AND COALESCE(op.verified_at, op.quoted_at) > COALESCE(ls.settled_at, '-infinity'::timestamptz)
      ) cyc ON true
      LEFT JOIN LATERAL (
        SELECT (
          COALESCE((SELECT SUM(t.earned) FROM (
                      SELECT ROUND(SUM(so.total_usd * rp.commission_rate), 2) AS earned
                      FROM sales_orders so
                      JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
                      WHERE so.sales_rep_user_profile_id IS NOT NULL AND so.status NOT IN ('cancelled', 'quote')
                        AND rp.division = div.d
                      GROUP BY so.sales_rep_user_profile_id) t), 0)
          - COALESCE((SELECT SUM(cp.amount_usd) FROM commission_payments cp
                      JOIN user_profiles pu ON pu.id = cp.sales_rep_user_profile_id
                      WHERE cp.payee_type = 'sales_rep' AND pu.division = div.d), 0)
        )::numeric(14,2) AS outstanding
      ) rep ON true
      LEFT JOIN LATERAL (
        SELECT (CASE WHEN div.d = 'us' THEN
          COALESCE((SELECT SUM(internal_shipping_cost_usd) FROM shipments_outbound
                    WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments WHERE payee_type = 'warehouse'), 0)
        ELSE 0 END)::numeric(14,2) AS outstanding
      ) wh ON true
      LEFT JOIN LATERAL (
        -- Operator-fronted costs (product testing etc.) reimbursed like a
        -- payee: lifetime incurred minus lifetime reimbursements.
        SELECT (
          COALESCE((SELECT SUM(amount_usd) FROM operating_expenses
                    WHERE division = div.d), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments
                      WHERE payee_type = 'expense' AND division = div.d), 0)
        )::numeric(14,2) AS outstanding
      ) exp ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount_usd), 0)::numeric(14,2) AS paid
        FROM commission_payments
        WHERE payee_type = 'vendor' AND division = div.d
          AND paid_at > COALESCE(ls.settled_at, '-infinity'::timestamptz)
      ) vpc ON true
      LEFT JOIN LATERAL (
        -- Cash remaining for the vendor in this division: per-payee
        -- GREATEST(earned, paid), because an overpaid payee (rate lowered
        -- after payment) already consumed the cash. Must mirror
        -- executeSettlementAtomic vendor_bal exactly — this figure is what
        -- Settle All will pay.
        SELECT (
          COALESCE((SELECT SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END)
                    FROM order_payments op
                    JOIN sales_orders so2 ON so2.id = op.sales_order_id
                    LEFT JOIN user_profiles orp ON orp.id = so2.sales_rep_user_profile_id
                    WHERE op.verification_status = 'verified'
                      AND COALESCE(orp.division, 'us') = div.d), 0)
          - COALESCE((SELECT SUM(GREATEST(COALESCE(o.earned, 0), COALESCE(p.paid, 0)))
                      FROM user_profiles up2
                      LEFT JOIN (
                        SELECT so.sales_rep_user_profile_id AS rid, ROUND(SUM(so.total_usd * rp.commission_rate), 2) AS earned
                        FROM sales_orders so
                        JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
                        WHERE so.status NOT IN ('cancelled', 'quote')
                        GROUP BY so.sales_rep_user_profile_id) o ON o.rid = up2.id
                      LEFT JOIN (
                        SELECT sales_rep_user_profile_id AS rid, SUM(amount_usd) AS paid
                        FROM commission_payments WHERE payee_type = 'sales_rep'
                        GROUP BY sales_rep_user_profile_id) p ON p.rid = up2.id
                      WHERE up2.division = div.d), 0)
          - COALESCE((SELECT SUM(GREATEST(COALESCE(e.earned, 0), COALESCE(p.paid, 0)))
                      FROM warehouses w2
                      LEFT JOIN (
                        SELECT origin_warehouse_id AS wid, SUM(internal_shipping_cost_usd) AS earned
                        FROM shipments_outbound
                        WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL
                        GROUP BY origin_warehouse_id) e ON e.wid = w2.id
                      LEFT JOIN (
                        SELECT warehouse_id AS wid, SUM(amount_usd) AS paid
                        FROM commission_payments WHERE payee_type = 'warehouse'
                        GROUP BY warehouse_id) p ON p.wid = w2.id
                      WHERE div.d = 'us'), 0)
          - GREATEST(
              COALESCE((SELECT SUM(amount_usd) FROM operating_expenses
                        WHERE division = div.d), 0),
              COALESCE((SELECT SUM(amount_usd) FROM commission_payments
                        WHERE payee_type = 'expense' AND division = div.d), 0))
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments
                      WHERE payee_type = 'vendor' AND division = div.d), 0)
        )::numeric(14,2) AS balance
      ) owed ON true
    `,
  });
}

export default getVendorBalance;
