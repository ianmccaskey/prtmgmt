import { action } from '@uibakery/data';

/**
 * Tracking said DELIVERED: single atomic statement flips the shipment to
 * delivered, promotes the order to delivered when it was fully shipped and
 * every other shipment is already delivered (partially_shipped orders keep
 * their status — lines are still pending), and audit-logs the auto change.
 * The o.id <> ship.id guard exists because the outer UPDATE's subquery reads
 * the pre-CTE snapshot and can't see this shipment's own flip.
 */
function markShipmentDeliveredByTracking() {
  return action('markShipmentDeliveredByTracking', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH ship AS (
        UPDATE shipments_outbound SET
          status = 'delivered',
          delivered_date = COALESCE(delivered_date, {{params.delivered_date}}::date, CURRENT_DATE),
          tracking_status = 'DELIVERED',
          tracking_checked_at = NOW()
        WHERE id = {{params.shipment_id}}::bigint AND status = 'in_transit'
        RETURNING id, sales_order_id
      ),
      ord AS (
        UPDATE sales_orders so SET status = 'delivered'
        FROM ship
        WHERE so.id = ship.sales_order_id
          AND so.status = 'shipped'
          AND NOT EXISTS (
            SELECT 1 FROM shipments_outbound o
            WHERE o.sales_order_id = so.id AND o.id <> ship.id AND o.status <> 'delivered'
          )
        RETURNING so.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
      SELECT ord.id, NULL, 'status', 'status', 'shipped', 'delivered', 'Auto-delivered via Shippo tracking'
      FROM ord
      RETURNING sales_order_id
    `,
  });
}

export default markShipmentDeliveredByTracking;
