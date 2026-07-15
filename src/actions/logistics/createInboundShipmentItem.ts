import { action } from '@uibakery/data';

function createInboundShipmentItem() {
  return action('createInboundShipmentItem', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO shipments_inbound_items (
        shipment_id, product_id, batch_id, destination_warehouse_id,
        quantity_shipped, expected_arrival_date, receive_address_id
      ) VALUES (
        {{params.shipment_id}}, {{params.product_id}}, {{params.batch_id}},
        {{params.destination_warehouse_id}}, {{params.quantity_shipped}},
        {{params.expected_arrival_date}}, {{params.receive_address_id}}
      ) RETURNING id
    `,
  });
}

export default createInboundShipmentItem;
