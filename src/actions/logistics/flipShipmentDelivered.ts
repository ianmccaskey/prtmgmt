import { action } from '@uibakery/data';

function flipShipmentDelivered() {
  return action('flipShipmentDelivered', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_inbound
      SET status = CASE
        WHEN (
          SELECT COUNT(*) FROM shipments_inbound_items
          WHERE shipment_id = {{params.shipment_id}} AND quantity_received IS NULL
        ) = 0 THEN 'delivered'
        ELSE 'in_transit'
      END
      WHERE id = {{params.shipment_id}}
      RETURNING id, status
    `,
  });
}

export default flipShipmentDelivered;
