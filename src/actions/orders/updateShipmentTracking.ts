import { action } from '@uibakery/data';

/**
 * Record the latest (non-delivered) tracking status + poll timestamp.
 * A RETURNED status auto-raises the returned_to_sender issue flag so the
 * shipment surfaces on the dashboard instead of silently polling forever.
 */
function updateShipmentTracking() {
  return action('updateShipmentTracking', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_outbound SET
        tracking_status = {{params.tracking_status}},
        tracking_checked_at = NOW(),
        issue_flag = CASE
          WHEN {{params.tracking_status}} = 'RETURNED' AND issue_flag IS NULL THEN 'returned_to_sender'
          ELSE issue_flag
        END,
        issue_flagged_at = CASE
          WHEN {{params.tracking_status}} = 'RETURNED' AND issue_flag IS NULL THEN NOW()
          ELSE issue_flagged_at
        END
      WHERE id = {{params.shipment_id}}::bigint
      RETURNING id
    `,
  });
}

export default updateShipmentTracking;
