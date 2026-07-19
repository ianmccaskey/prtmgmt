import { action } from '@uibakery/data';

function getBatchInboundShipments() {
  return action('getBatchInboundShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        si.id AS shipment_id, si.reference_number, si.status, '#' || si.tracking_number AS tracking_number,
        si.arrival_date, si.mode,
        f.name AS factory_name,
        sii.quantity_shipped, sii.quantity_received, sii.condition_flag,
        w.name AS destination_warehouse
      FROM shipments_inbound_items sii
      JOIN shipments_inbound si ON si.id = sii.shipment_id
      LEFT JOIN factories f ON f.id = si.factory_id
      LEFT JOIN warehouses w ON w.id = sii.destination_warehouse_id
      WHERE sii.batch_id = {{params.batch_id}}
      ORDER BY si.arrival_date DESC
    `,
  });
}

export default getBatchInboundShipments;
