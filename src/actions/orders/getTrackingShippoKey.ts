import { action } from '@uibakery/data';

/**
 * The Shippo API key designated for tracking all shipped orders (Settings →
 * Warehouses → Shippo → "use for tracking"). Tracking is read-only and
 * account-agnostic; label purchasing stays scoped to each warehouse's key.
 */
function getTrackingShippoKey() {
  return action('getTrackingShippoKey', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT w.id AS warehouse_id, w.shippo_api_key
      FROM warehouses w
      JOIN app_settings s ON s.key = 'shippo_tracking_warehouse_id' AND s.value = w.id::text
      WHERE w.is_active = true AND w.shippo_api_key IS NOT NULL
    `,
  });
}

export default getTrackingShippoKey;
