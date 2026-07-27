import { action } from '@uibakery/data';

/**
 * Full wallet settlement in ONE statement (one snapshot — the "stamp"),
 * scoped to ONE division (us | china — the two pipelines never mix):
 * computes every in-division rep balance, warehouse balances (US only —
 * warehouses live entirely in the US pipeline), and the division's vendor
 * share as of this instant, writes a settlements row with the stamped
 * totals, and inserts one commission_payment per payee for exactly the
 * owed amount (all linked via settlement_id and carrying the division).
 * Every in-division ledger reads zero immediately after; later activity
 * accrues to that division's next settlement. A payment's division is its
 * ORDER's rep's division (no rep = us). Balance formulas mirror
 * listRepBalances / listWarehouseBalances / getVendorBalance exactly.
 * A negative vendor share stamps/pays 0 (the shortfall carries).
 */
function executeSettlementAtomic() {
  return action('executeSettlementAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH div AS (
        SELECT COALESCE(NULLIF({{params.division}}, ''), 'us') AS d
      ),
      rep_bal AS (
        SELECT up.id AS rep_id, COALESCE(o.earned, 0) - COALESCE(p.paid, 0) AS owed
        FROM user_profiles up
        LEFT JOIN (
          SELECT so.sales_rep_user_profile_id AS rid, ROUND(SUM(so.total_usd * rp.commission_rate), 2) AS earned
          FROM sales_orders so
          JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
          WHERE so.sales_rep_user_profile_id IS NOT NULL AND so.status NOT IN ('cancelled', 'quote')
          GROUP BY so.sales_rep_user_profile_id
        ) o ON o.rid = up.id
        LEFT JOIN (
          SELECT sales_rep_user_profile_id AS rid, SUM(amount_usd) AS paid
          FROM commission_payments WHERE payee_type = 'sales_rep'
          GROUP BY sales_rep_user_profile_id
        ) p ON p.rid = up.id
        WHERE up.division = (SELECT d FROM div)
          AND COALESCE(o.earned, 0) - COALESCE(p.paid, 0) > 0
      ),
      wh_bal AS (
        SELECT w.id AS wh_id, COALESCE(e.earned, 0) - COALESCE(p.paid, 0) AS owed
        FROM warehouses w
        LEFT JOIN (
          SELECT origin_warehouse_id AS wid, SUM(internal_shipping_cost_usd) AS earned
          FROM shipments_outbound
          WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL
          GROUP BY origin_warehouse_id
        ) e ON e.wid = w.id
        LEFT JOIN (
          SELECT warehouse_id AS wid, SUM(amount_usd) AS paid
          FROM commission_payments WHERE payee_type = 'warehouse'
          GROUP BY warehouse_id
        ) p ON p.wid = w.id
        WHERE (SELECT d FROM div) = 'us'
          AND COALESCE(e.earned, 0) - COALESCE(p.paid, 0) > 0
      ),
      collected AS (
        -- The division's collections: a payment belongs to its order's
        -- rep's division (orders with no rep are US).
        SELECT COALESCE(SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END), 0) AS total
        FROM order_payments op
        JOIN sales_orders so2 ON so2.id = op.sales_order_id
        LEFT JOIN user_profiles orp ON orp.id = so2.sales_rep_user_profile_id
        WHERE op.verification_status = 'verified'
          AND COALESCE(orp.division, 'us') = (SELECT d FROM div)
      ),
      vendor_bal AS (
        -- Vendor gets the CASH remaining in this division: collected minus
        -- what each in-division payee consumed — GREATEST(earned, paid) per
        -- payee, since an overpaid payee (e.g. a rep whose rate was lowered
        -- after payment) already took the cash even though their earned
        -- figure shrank. Warehouses consume from the US pipeline only.
        SELECT GREATEST(0,
          (SELECT total FROM collected)
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
                      WHERE up2.division = (SELECT d FROM div)), 0)
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
                      WHERE (SELECT d FROM div) = 'us'), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments
                      WHERE payee_type = 'vendor' AND division = (SELECT d FROM div)), 0)
        ) AS owed
      ),
      stamp AS (
        INSERT INTO settlements (note, created_by_user_id, collected_usd, rep_commissions_usd, warehouse_earned_usd, vendor_share_usd, division)
        SELECT
          {{params.note}},
          {{params.user_id}}::bigint,
          (SELECT total FROM collected),
          COALESCE((SELECT SUM(owed) FROM rep_bal), 0),
          COALESCE((SELECT SUM(owed) FROM wh_bal), 0),
          (SELECT owed FROM vendor_bal),
          (SELECT d FROM div)
        RETURNING id
      ),
      pay_reps AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id, division)
        SELECT 'sales_rep', rep_id, NULL, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp), (SELECT d FROM div)
        FROM rep_bal
        RETURNING id
      ),
      pay_whs AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id, division)
        SELECT 'warehouse', NULL, wh_id, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp), (SELECT d FROM div)
        FROM wh_bal
        RETURNING id
      ),
      pay_vendor AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id, division)
        SELECT 'vendor', NULL, NULL, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp), (SELECT d FROM div)
        FROM vendor_bal
        WHERE owed > 0
        RETURNING id
      )
      SELECT
        (SELECT id FROM stamp) AS settlement_id,
        (SELECT COUNT(*) FROM pay_reps)::int AS rep_payments,
        (SELECT COUNT(*) FROM pay_whs)::int AS warehouse_payments,
        (SELECT COUNT(*) FROM pay_vendor)::int AS vendor_payments
    `,
  });
}

export default executeSettlementAtomic;
