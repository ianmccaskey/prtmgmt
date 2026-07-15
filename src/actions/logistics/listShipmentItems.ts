import { action } from '@uibakery/data';

function listShipmentItems() {
  return action('listShipmentItems', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        sii.id, sii.shipment_id, sii.product_id, sii.batch_id,
        sii.destination_warehouse_id, sii.quantity_shipped, sii.quantity_received,
        sii.condition_flag, sii.discrepancy_notes, sii.evidence_url,
        sii.expected_arrival_date, sii.received_at,
        p.sku, p.name AS product_name,
        pb.batch_number, pb.qc_status,
        w.name AS destination_warehouse_name,
        sii.receive_address_id,
        ra.label AS receive_address_label,
        ra.address_name AS receive_address_name,
        ra.address_line1 AS receive_address_line1,
        ra.city AS receive_address_city
      FROM shipments_inbound_items sii
      JOIN products p ON p.id = sii.product_id
      LEFT JOIN product_batches pb ON pb.id = sii.batch_id
      LEFT JOIN warehouses w ON w.id = sii.destination_warehouse_id
      LEFT JOIN warehouse_receive_addresses ra ON ra.id = sii.receive_address_id
      WHERE sii.shipment_id = {{params.shipment_id}}
      ORDER BY sii.id ASC
    `,
  });
}

export default listShipmentItems;
