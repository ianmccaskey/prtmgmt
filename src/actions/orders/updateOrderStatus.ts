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
 * Cancelling auto-flags any verified incoming payments still attached:
 * a cancelled order's verified payment keeps counting in the wallet
 * expected-inflow math until someone deals with it (refund the real money,
 * or mark a duplicate/phantom record failed) — twice now one slipped
 * through silently (ORD-2026-0042, ORD-2026-0163). Existing issue notes
 * are never overwritten.
 */
export function updateOrderStatus() {
  return action('updateOrderStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE sales_orders
        SET
          status = {{params.status}},
          cancellation_reason = CASE WHEN {{params.status}} = 'cancelled' THEN {{params.cancellationReason}} ELSE cancellation_reason END
        WHERE id = {{params.orderId}}::bigint
          AND (
            ({{params.status}} = 'confirmed' AND status = 'quote'
              AND (payment_status IN ('paid', 'partial_paid')
                   OR EXISTS (SELECT 1 FROM user_profiles rp
                              WHERE rp.id = sales_orders.sales_rep_user_profile_id
                                AND rp.division = 'china'))) OR
            ({{params.status}} = 'delivered' AND status = 'shipped') OR
            ({{params.status}} = 'cancelled' AND status IN ('quote', 'confirmed', 'partially_shipped'))
          )
        RETURNING id, status
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
      )
      SELECT id, status FROM upd
    `,
  });
}

export default updateOrderStatus;
