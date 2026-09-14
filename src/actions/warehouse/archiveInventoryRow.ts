import { action } from '@uibakery/data';

/**
 * Archive an exhausted inventory row (finite batch, never refilling) so
 * the warehouse list stops showing it. Guarded server-side — refuses
 * (0 rows) unless the row is truly dead: zero on hand, zero reserved,
 * and nothing inbound for this batch+warehouse on an undelivered
 * shipment. The DB trigger (inventory_auto_unarchive) restores the row
 * automatically if stock ever comes back.
 */
function archiveInventoryRow() {
  return action('archiveInventoryRow', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inventory i SET archived_at = NOW()
      WHERE i.id = {{params.id}}::bigint
        AND i.archived_at IS NULL
        AND i.quantity_on_hand = 0
        AND i.quantity_reserved = 0
        AND NOT EXISTS (
          SELECT 1 FROM shipments_inbound_items sii
          JOIN shipments_inbound si ON si.id = sii.shipment_id
          WHERE sii.batch_id = i.batch_id
            AND sii.destination_warehouse_id = i.warehouse_id
            AND si.status != 'delivered'
            AND sii.quantity_shipped - COALESCE(sii.quantity_received, 0) > 0)
      RETURNING i.id
    `,
  });
}

export default archiveInventoryRow;
