import { action } from '@uibakery/data';

/**
 * Refuses (0 rows) a MANUAL flip to 'delivered' while un-received lines
 * exist: 'delivered' removes the shipment from the warehouse receive
 * queue (listInTransitInbound filters it out), so flipping early strands
 * the lines — receiving the last line flips the status automatically via
 * receiveLineAtomic (this bit both PRT-RT10TE10-0926 shipments).
 */
function updateShipmentStatus() {
  return action('updateShipmentStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_inbound si
      SET status = {{params.status}},
          customs_status = COALESCE({{params.customs_status}}, customs_status),
          tracking_number = COALESCE({{params.tracking_number}}, tracking_number),
          notes = COALESCE({{params.notes}}, notes)
      WHERE si.id = {{params.id}}
        AND ({{params.status}} <> 'delivered'
             OR NOT EXISTS (SELECT 1 FROM shipments_inbound_items x
                            WHERE x.shipment_id = si.id AND x.quantity_received IS NULL))
      RETURNING si.id, si.status
    `,
  });
}

export default updateShipmentStatus;
