import { action } from '@uibakery/data';

/**
 * Status update with the allowed-transition chain enforced in SQL:
 * quote→confirmed (ONLY when payment_status is paid/partial_paid — except
 * China-division orders, whose customers pay the rep's own wallet BEFORE
 * the order is entered, so no in-app payment gates them),
 * shipped→delivered, and cancelled from quote/confirmed/partially_shipped.
 * Shipping transitions happen only through the fulfillment/china flows.
 * Returns zero rows when the transition isn't allowed.
 *
 * ATOMIC SIDE EFFECTS (2026-09 hardening — three orders were stranded by
 * browser chains dying between this call and their follow-ups: 0239,
 * 0257, and the cancel flow had the same exposure):
 *  - every successful transition writes its own audit row (old → new,
 *    with the caller's note), so a confirmed/cancelled order can never
 *    again lack a trail;
 *  - confirm re-derives payment_status in the same statement (china
 *    orders → 'paid', $0 orders → 'paid') so the china/free derivation
 *    can't be skipped;
 *  - cancel RELEASES the order's reservation ledger and decrements the
 *    exact inventory rows it pointed at (other orders' stock untouched),
 *    and auto-flags verified incoming payments (a cancelled order's
 *    verified payment keeps counting in wallet expected-inflow math
 *    until someone deals with it — ORD-2026-0042/0163 class). Existing
 *    issue notes are never overwritten.
 *
 * Reservation CREATION on confirm stays caller-driven (batch pins and
 * per-line warehouses need the form's context); the items panel surfaces
 * any under-reserved line with a one-click repair.
 */
export function updateOrderStatus() {
  return action('updateOrderStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH cur AS (
        SELECT id, status AS old_status FROM sales_orders
        WHERE id = {{params.orderId}}::bigint
      ),
      upd AS (
        UPDATE sales_orders so
        SET
          status = {{params.status}},
          cancellation_reason = CASE WHEN {{params.status}} = 'cancelled' THEN {{params.cancellationReason}} ELSE so.cancellation_reason END,
          payment_status = CASE
            WHEN {{params.status}} = 'confirmed'
              AND (so.total_usd = 0
                   OR EXISTS (SELECT 1 FROM user_profiles rp
                              WHERE rp.id = so.sales_rep_user_profile_id
                                AND rp.division = 'china'))
            THEN 'paid' ELSE so.payment_status END
        FROM cur
        WHERE so.id = cur.id
          AND (
            ({{params.status}} = 'confirmed' AND so.status = 'quote'
              AND (so.payment_status IN ('paid', 'partial_paid')
                   OR so.total_usd = 0
                   OR EXISTS (SELECT 1 FROM user_profiles rp
                              WHERE rp.id = so.sales_rep_user_profile_id
                                AND rp.division = 'china'))) OR
            ({{params.status}} = 'delivered' AND so.status = 'shipped') OR
            ({{params.status}} = 'cancelled' AND so.status IN ('quote', 'confirmed', 'partially_shipped'))
          )
        RETURNING so.id, so.status, cur.old_status
      ),
      flag_pay AS (
        UPDATE order_payments op
        SET issue_type = COALESCE(op.issue_type, 'other'),
            issue_notes = COALESCE(NULLIF(op.issue_notes, ''),
              'Auto-flag: order was cancelled with this verified payment attached. Review it — real money needs a refund; a duplicate or phantom record should be marked failed so it stops counting in the wallet audit.')
        FROM upd
        WHERE {{params.status}} = 'cancelled'
          AND op.sales_order_id = upd.id
          AND op.verification_status = 'verified'
          AND op.direction <> 'refund'
      ),
      rel AS (
        DELETE FROM inventory_reservations ir
        USING upd
        WHERE {{params.status}} = 'cancelled' AND ir.sales_order_id = upd.id
        RETURNING ir.inventory_id, ir.quantity
      ),
      rel_agg AS (
        SELECT inventory_id, SUM(quantity) AS qty FROM rel GROUP BY inventory_id
      ),
      rel_inv AS (
        UPDATE inventory i
        SET quantity_reserved = GREATEST(0, i.quantity_reserved - a.qty)
        FROM rel_agg a WHERE a.inventory_id = i.id
      ),
      audit AS (
        INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
        SELECT upd.id, {{params.userId}}::bigint, NOW(), 'status', 'status', upd.old_status, upd.status,
          NULLIF({{params.note}}, '')
        FROM upd
      )
      SELECT id, status FROM upd
    `,
  });
}

export default updateOrderStatus;
