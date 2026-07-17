import { action } from '@uibakery/data';

function listInTransitInbound() {
  return action('listInTransitInbound', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        sii.id, sii.shipment_id, sii.product_id, sii.batch_id,
        sii.quantity_shipped, sii.quantity_received, sii.expected_arrival_date,
        sii.condition_flag,
        p.sku, p.name AS product_name,
        pb.batch_number,
        w.name AS destination_warehouse, w.name AS destination_warehouse_name, w.id AS destination_warehouse_id,
        si.reference_number, si.status AS shipment_status, si.arrival_date
      FROM shipments_inbound_items sii
      JOIN shipments_inbound si ON si.id = sii.shipment_id
      JOIN products p ON p.id = sii.product_id
      LEFT JOIN product_batches pb ON pb.id = sii.batch_id
      LEFT JOIN warehouses w ON w.id = sii.destination_warehouse_id
      WHERE si.status != 'delivered'
        AND (COALESCE({{params.warehouse_id}}, '') = '' OR sii.destination_warehouse_id::text = {{params.warehouse_id}})
      ORDER BY COALESCE(sii.expected_arrival_date, si.arrival_date) ASC
    `,
  });
}

export default listInTransitInbound;
