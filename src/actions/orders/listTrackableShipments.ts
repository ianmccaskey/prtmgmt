import { action } from '@uibakery/data';

/**
 * In-transit outbound shipments due for a tracking poll. The 30-minute
 * throttle on tracking_checked_at keeps app reloads from hammering Shippo.
 * Tracking number carries the '#' guard (client numeric parsing) — dbText().
 */
function listTrackableShipments() {
  return action('listTrackableShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT so2.id, so2.sales_order_id, so2.carrier,
        '#' || so2.tracking_number AS tracking_number, so2.tracking_status
      FROM shipments_outbound so2
      WHERE so2.status = 'in_transit'
        AND so2.tracking_number IS NOT NULL
        AND so2.carrier IN ('USPS', 'UPS', 'FedEx', 'DHL')
        AND (so2.tracking_checked_at IS NULL OR so2.tracking_checked_at < NOW() - INTERVAL '30 minutes')
        AND (so2.tracking_status IS NULL OR so2.tracking_status NOT IN ('RETURNED', 'FAILURE'))
      ORDER BY so2.id
      LIMIT 50
    `,
  });
}

export default listTrackableShipments;
