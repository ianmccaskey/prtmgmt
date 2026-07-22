import { action } from '@uibakery/data';

/**
 * Full wallet settlement in ONE statement (one snapshot — the "stamp"):
 * computes every rep balance, every warehouse balance, and the vendor
 * share as of this instant, writes a settlements row with the stamped
 * totals, and inserts one commission_payment per payee for exactly the
 * owed amount (all linked via settlement_id). Every ledger reads zero
 * immediately after; later activity accrues to the next settlement.
 * Balance formulas mirror listRepBalances / listWarehouseBalances /
 * getVendorBalance exactly. A negative vendor share stamps/pays 0 (the
 * shortfall carries into the next cycle).
 */
function executeSettlementAtomic() {
  return action('executeSettlementAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH rep_bal AS (
        SELECT up.id AS rep_id, COALESCE(o.earned, 0) - COALESCE(p.paid, 0) AS owed
        FROM user_profiles up
        LEFT JOIN (
          SELECT sales_rep_user_profile_id AS rid, SUM(total_usd * 0.10) AS earned
          FROM sales_orders
          WHERE sales_rep_user_profile_id IS NOT NULL AND status NOT IN ('cancelled', 'quote')
          GROUP BY sales_rep_user_profile_id
        ) o ON o.rid = up.id
        LEFT JOIN (
          SELECT sales_rep_user_profile_id AS rid, SUM(amount_usd) AS paid
          FROM commission_payments WHERE payee_type = 'sales_rep'
          GROUP BY sales_rep_user_profile_id
        ) p ON p.rid = up.id
        WHERE COALESCE(o.earned, 0) - COALESCE(p.paid, 0) > 0
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
        WHERE COALESCE(e.earned, 0) - COALESCE(p.paid, 0) > 0
      ),
      vendor_bal AS (
        SELECT GREATEST(0,
          COALESCE((SELECT SUM(CASE WHEN direction = 'refund' THEN -amount_usd ELSE amount_usd END)
                    FROM order_payments WHERE verification_status = 'verified'), 0)
          - COALESCE((SELECT SUM(total_usd * 0.10) FROM sales_orders
                      WHERE sales_rep_user_profile_id IS NOT NULL AND status NOT IN ('cancelled', 'quote')), 0)
          - COALESCE((SELECT SUM(internal_shipping_cost_usd) FROM shipments_outbound
                      WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL), 0)
          - COALESCE((SELECT SUM(amount_usd) FROM commission_payments WHERE payee_type = 'vendor'), 0)
        ) AS owed
      ),
      stamp AS (
        INSERT INTO settlements (note, created_by_user_id, collected_usd, rep_commissions_usd, warehouse_earned_usd, vendor_share_usd)
        SELECT
          {{params.note}},
          {{params.user_id}}::bigint,
          COALESCE((SELECT SUM(CASE WHEN direction = 'refund' THEN -amount_usd ELSE amount_usd END)
                    FROM order_payments WHERE verification_status = 'verified'), 0),
          COALESCE((SELECT SUM(owed) FROM rep_bal), 0),
          COALESCE((SELECT SUM(owed) FROM wh_bal), 0),
          (SELECT owed FROM vendor_bal)
        RETURNING id
      ),
      pay_reps AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id)
        SELECT 'sales_rep', rep_id, NULL, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp)
        FROM rep_bal
        RETURNING id
      ),
      pay_whs AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id)
        SELECT 'warehouse', NULL, wh_id, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp)
        FROM wh_bal
        RETURNING id
      ),
      pay_vendor AS (
        INSERT INTO commission_payments (payee_type, sales_rep_user_profile_id, warehouse_id, amount_usd, paid_by_user_id, note, settlement_id)
        SELECT 'vendor', NULL, NULL, owed, {{params.user_id}}::bigint,
               'Settlement #' || (SELECT id FROM stamp), (SELECT id FROM stamp)
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
