import { action } from '@uibakery/data';

/** Record the latest (non-delivered) tracking status + poll timestamp. */
function updateShipmentTracking() {
  return action('updateShipmentTracking', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_outbound SET
        tracking_status = {{params.tracking_status}},
        tracking_checked_at = NOW()
      WHERE id = {{params.shipment_id}}::bigint
      RETURNING id
    `,
  });
}

export default updateShipmentTracking;
