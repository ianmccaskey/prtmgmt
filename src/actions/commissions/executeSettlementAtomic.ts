import { action } from '@uibakery/data';

/**
 * Close the division's settlement cycle — the stamp AFTER the money moved,
 * never a step that records payouts itself. Refuses (settlement_id NULL,
 * outstanding figures returned) unless every balance has been paid down to
 * zero via actually-recorded payments: every in-division rep, every
 * warehouse (US pipeline only), and the vendor. When clean, ONE statement
 * stamps the settlements row with the CYCLE's figures — collections since
 * the division's last stamp and the payments recorded during the cycle —
 * and inserts nothing else. Every ledger already reads zero; the stamp
 * just closes the window the next cycle accrues against.
 *
 * (Historical note: stamps #1–2 recorded payouts at settle time and stored
 * lifetime collections. Ian's real flow is pay-first-then-close, so the
 * old mode could invent payments that never happened.)
 *
 * A payment's division is its order's rep's division (no rep = us); rep
 * balances follow the rep's CURRENT division, mirroring listRepBalances /
 * getVendorBalance / listSettlementPayments exactly.
 *
 * Known race (accepted, same class as correction-vs-settlement): a
 * commission payment committing in the same instant as the close may land
 * with paid_at just inside the closed window without being in the stamp's
 * sums. Both operations are manual and typically the same person seconds
 * apart; a hit only skews the stamped summary line, never a balance —
 * balances are always recomputed live.
 */
function executeSettlementAtomic() {
  return action('executeSettlementAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH div AS (
        SELECT COALESCE(NULLIF({{params.division}}, ''), 'us') AS d
      ),
      last_stamp AS (
        SELECT COALESCE(MAX(settled_at), '-infinity'::timestamptz) AS t
        FROM settlements WHERE division = (SELECT d FROM div)
      ),
      rep_out AS (
        -- Positive balances only: an overpaid rep must not offset an
        -- unpaid one.
        SELECT COALESCE(SUM(GREATEST(0, COALESCE(o.earned, 0) - COALESCE(p.paid, 0))), 0) AS owed
        FROM user_profiles up
        LEFT JOIN (
          SELECT so.sales_rep_user_profile_id AS rid, ROUND(SUM(so.total_usd * rp.commission_rate), 2) AS earned
          FROM sales_orders so
          JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
          WHERE so.status NOT IN ('cancelled', 'quote')
          GROUP BY so.sales_rep_user_profile_id
        ) o ON o.rid = up.id
        LEFT JOIN (
          SELECT sales_rep_user_profile_id AS rid, SUM(amount_usd) AS paid
          FROM commission_payments WHERE payee_type = 'sales_rep'
          GROUP BY sales_rep_user_profile_id
        ) p ON p.rid = up.id
        WHERE up.division = (SELECT d FROM div)
      ),
      wh_out AS (
        SELECT COALESCE(SUM(GREATEST(0, COALESCE(e.earned, 0) - COALESCE(p.paid, 0))), 0) AS owed
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
      ),
      vendor_out AS (
        -- Lifetime vendor balance (cash remaining), mirroring
        -- getVendorBalance: collected minus per-payee GREATEST(earned,
        -- paid) minus vendor payments. Negative (overpaid vendor) does not
        -- block closing.
        SELECT (
          COALESCE((SELECT SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END)
                    FROM order_payments op
                    JOIN sales_orders so2 ON so2.id = op.sales_order_id
                    LEFT JOIN user_profiles orp ON orp.id = so2.sales_rep_user_profile_id
                    WHERE op.verification_status = 'verified'
                      AND COALESCE(orp.division, 'us') = (SELECT d FROM div)), 0)
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
      ok AS (
        SELECT (SELECT owed FROM rep_out) <= 0.004
           AND (SELECT owed FROM wh_out) <= 0.004
           AND (SELECT owed FROM vendor_out) <= 0.004 AS pass
      ),
      stamp AS (
        INSERT INTO settlements (note, created_by_user_id, collected_usd, rep_commissions_usd, warehouse_earned_usd, vendor_share_usd, division)
        SELECT
          {{params.note}},
          {{params.user_id}}::bigint,
          COALESCE((SELECT SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END)
                    FROM order_payments op
                    JOIN sales_orders so2 ON so2.id = op.sales_order_id
                    LEFT JOIN user_profiles orp ON orp.id = so2.sales_rep_user_profile_id
                    WHERE op.verification_status = 'verified'
                      AND COALESCE(orp.division, 'us') = (SELECT d FROM div)
                      AND COALESCE(op.verified_at, op.quoted_at) > (SELECT t FROM last_stamp)), 0),
          COALESCE((SELECT SUM(cp.amount_usd) FROM commission_payments cp
                    WHERE cp.payee_type = 'sales_rep'
                      AND cp.paid_at > (SELECT t FROM last_stamp)
                      AND (cp.division = (SELECT d FROM div)
                           OR EXISTS (SELECT 1 FROM user_profiles pu
                                      WHERE pu.id = cp.sales_rep_user_profile_id
                                        AND pu.division = (SELECT d FROM div)))), 0),
          COALESCE((SELECT SUM(cp.amount_usd) FROM commission_payments cp
                    WHERE cp.payee_type = 'warehouse'
                      AND (SELECT d FROM div) = 'us'
                      AND cp.paid_at > (SELECT t FROM last_stamp)), 0),
          COALESCE((SELECT SUM(cp.amount_usd) FROM commission_payments cp
                    WHERE cp.payee_type = 'vendor' AND cp.division = (SELECT d FROM div)
                      AND cp.paid_at > (SELECT t FROM last_stamp)), 0),
          (SELECT d FROM div)
        WHERE (SELECT pass FROM ok)
        RETURNING id
      )
      SELECT
        (SELECT id FROM stamp) AS settlement_id,
        (SELECT owed FROM rep_out)::numeric(14,2) AS rep_outstanding,
        (SELECT owed FROM wh_out)::numeric(14,2) AS warehouse_outstanding,
        (SELECT owed FROM vendor_out)::numeric(14,2) AS vendor_outstanding
    `,
  });
}

export default executeSettlementAtomic;
