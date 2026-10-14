import { action } from '@uibakery/data';

/**
 * Set the order's rep assignment: primary rep, optional second rep, and
 * the split (rep_split_pct = PRIMARY's share of the commission basis;
 * each rep earns their own rate on their share). The second rep is
 * DROPPED (split forced 100) when missing, equal to the primary, or in
 * a DIFFERENT DIVISION — the money pipelines are per division and the
 * vendor's collected is primary-scoped, so a cross-division split would
 * accrue commission in a division that never collected the money. The
 * `pick` CTE computes the accepted values exactly once; the UPDATE and
 * the audit row both read it, so they can never drift. One statement.
 */
function updateOrderSalesRep() {
  return action('updateOrderSalesRep', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH pick AS (
        SELECT
          NULLIF({{params.salesRepUserProfileId}}, '')::bigint AS rep1,
          -- A second rep requires a REAL primary: r1.id IS NULL covers both
          -- an unassign and a nonexistent primary id.
          CASE WHEN r1.id IS NULL OR r2.id IS NULL OR r2.id = r1.id
                 OR COALESCE(r2.division, 'us') <> COALESCE(r1.division, 'us') THEN NULL
               ELSE r2.id END AS rep2,
          CASE WHEN r1.id IS NULL OR r2.id IS NULL OR r2.id = r1.id
                 OR COALESCE(r2.division, 'us') <> COALESCE(r1.division, 'us') THEN 100
               ELSE LEAST(99, GREATEST(1, COALESCE(NULLIF({{params.repSplitPct}}, '')::numeric, 50))) END AS split
        FROM (SELECT 1) one
        LEFT JOIN user_profiles r1 ON r1.id = NULLIF({{params.salesRepUserProfileId}}, '')::bigint
        LEFT JOIN user_profiles r2 ON r2.id = NULLIF({{params.salesRepUserProfileId2}}, '')::bigint
      ),
      old AS (
        SELECT so.id,
          COALESCE(o1.display_name, 'none') AS old_rep,
          o2.display_name AS old_rep2,
          so.rep_split_pct AS old_split
        FROM sales_orders so
        LEFT JOIN user_profiles o1 ON o1.id = so.sales_rep_user_profile_id
        LEFT JOIN user_profiles o2 ON o2.id = so.sales_rep_user_profile_id_2
        WHERE so.id = {{params.orderId}}::bigint
      ),
      upd AS (
        UPDATE sales_orders so SET
          sales_rep_user_profile_id = pick.rep1,
          sales_rep_user_profile_id_2 = pick.rep2,
          rep_split_pct = pick.split
        FROM old, pick
        WHERE so.id = old.id
        RETURNING so.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
      SELECT old.id, {{params.userId}}::bigint, NOW(), 'other', 'sales_reps',
        old.old_rep || CASE WHEN old.old_rep2 IS NOT NULL THEN ' ' || old.old_split || '% + ' || old.old_rep2 ELSE '' END,
        COALESCE((SELECT display_name FROM user_profiles WHERE id = pick.rep1), 'none')
          || CASE WHEN pick.rep2 IS NOT NULL
             THEN ' ' || pick.split || '% + ' || COALESCE((SELECT display_name FROM user_profiles WHERE id = pick.rep2), '?')
             ELSE '' END,
        NULL
      FROM old, pick
      WHERE EXISTS (SELECT 1 FROM upd)
      RETURNING sales_order_id
    `,
  });
}

export default updateOrderSalesRep;
