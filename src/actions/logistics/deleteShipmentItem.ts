import { action } from '@uibakery/data';

/**
 * Remove an inbound shipment line BEFORE receipt (entered by mistake).
 * Refuses (0 rows) once the line has been received — at that point it
 * backs real inventory and must not vanish.
 */
function deleteShipmentItem() {
  return action('deleteShipmentItem', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM shipments_inbound_items
      WHERE id = {{params.id}}::bigint
        AND quantity_received IS NULL
      RETURNING id
    `,
  });
}

export default deleteShipmentItem;
