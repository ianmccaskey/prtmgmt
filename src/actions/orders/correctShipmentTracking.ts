import { action } from '@uibakery/data';

/**
 * Correct a shipment's carrier/tracking number — ONE atomic statement:
 * snapshot + update + audit row + false-delivery revert. Changing the
 * number resets the tracking-sync state (status + checked-at) so the
 * server-side sync re-polls the NEW number. If the wrong number had
 * already auto-delivered the shipment, that delivery evidence belonged
 * to someone else's package: the shipment reverts to in_transit (date
 * cleared) and the order — if it was promoted to delivered — returns to
 * shipped; the sync re-delivers both once the real package lands.
 * Reason is required by the UI and lands in the order audit log with
 * the old and new values.
 */
export function correctShipmentTracking() {
  return action('correctShipmentTracking', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH before AS (
        SELECT s.id, s.sales_order_id, s.carrier, s.tracking_number, s.status
        FROM shipments_outbound s
        WHERE s.id = {{params.shipment_id}}::bigint
        FOR UPDATE
      ),
      upd AS (
        UPDATE shipments_outbound s
        SET carrier = {{params.carrier}},
            tracking_number = NULLIF({{params.tracking_number}}::text, ''),
            tracking_status = NULL,
            tracking_checked_at = NULL,
            status = CASE WHEN s.status = 'delivered' THEN 'in_transit' ELSE s.status END,
            delivered_date = CASE WHEN s.status = 'delivered' THEN NULL ELSE s.delivered_date END
        FROM before b
        WHERE s.id = b.id
        RETURNING s.id
      ),
      demote AS (
        UPDATE sales_orders o
        SET status = 'shipped'
        FROM before b
        WHERE o.id = b.sales_order_id AND o.status = 'delivered' AND b.status = 'delivered'
        RETURNING o.id
      ),
      audit_track AS (
        INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
        SELECT b.sales_order_id, {{params.userId}}::bigint, 'other', 'shipment_tracking',
               COALESCE(b.carrier, '?') || ' ' || COALESCE(b.tracking_number, '(none)'),
               {{params.carrier}} || ' ' || COALESCE(NULLIF({{params.tracking_number}}::text, ''), '(none)'),
               'Shipment #' || b.id || ' tracking corrected: ' || {{params.note}}
               || CASE WHEN b.status = 'delivered' THEN ' — false delivery reverted; re-tracking with the corrected number' ELSE '' END
        FROM before b
        RETURNING id
      ),
      audit_demote AS (
        INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
        SELECT d.id, {{params.userId}}::bigint, 'status', 'status', 'delivered', 'shipped',
               'Reverted by tracking correction on shipment #' || (SELECT id FROM before)
        FROM demote d
        RETURNING id
      )
      SELECT b.id, b.carrier AS old_carrier, b.tracking_number AS old_tracking,
             (SELECT COUNT(*) FROM demote)::int AS order_reverted
      FROM before b
    `,
  });
}

export default correctShipmentTracking;
