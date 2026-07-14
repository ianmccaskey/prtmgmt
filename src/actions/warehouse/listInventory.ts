import { action } from '@uibakery/data';

function listInventory() {
  return action('listInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        i.id, i.product_id, i.batch_id, i.warehouse_id,
        i.quantity_on_hand, i.quantity_reserved,
        i.quantity_on_hand - i.quantity_reserved AS quantity_available,
        p.sku, p.name AS product_name, p.category, p.list_price, p.low_stock_threshold,
        pb.batch_number, pb.qc_status, pb.manufacture_date,
        w.name AS warehouse_name,
        COALESCE((
          SELECT SUM(sii2.quantity_shipped - COALESCE(sii2.quantity_received, 0))
          FROM shipments_inbound_items sii2
          JOIN shipments_inbound si2 ON si2.id = sii2.shipment_id
          WHERE sii2.batch_id = i.batch_id AND sii2.destination_warehouse_id = i.warehouse_id
            AND si2.status != 'delivered'
        ), 0) AS in_transit_inbound,
        (
          SELECT MIN(sii3.expected_arrival_date)
          FROM shipments_inbound_items sii3
          JOIN shipments_inbound si3 ON si3.id = sii3.shipment_id
          WHERE sii3.batch_id = i.batch_id AND sii3.destination_warehouse_id = i.warehouse_id
            AND si3.status != 'delivered'
        ) AS next_arrival_date,
        (
          SELECT SUM(quantity_on_hand - quantity_reserved)
          FROM inventory i2 WHERE i2.product_id = i.product_id
        ) AS product_total_available
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN product_batches pb ON pb.id = i.batch_id
      JOIN warehouses w ON w.id = i.warehouse_id
      WHERE
        (COALESCE({{params.warehouse_id}}, '') = '' OR i.warehouse_id::text = {{params.warehouse_id}})
        AND (COALESCE({{params.product_id}}, '') = '' OR i.product_id::text = {{params.product_id}})
        AND (COALESCE({{params.batch_id}}, '') = '' OR i.batch_id::text = {{params.batch_id}})
        AND (COALESCE({{params.category}}, '') = '' OR p.category = {{params.category}})
        AND (COALESCE({{params.qc_status}}, '') = '' OR pb.qc_status = {{params.qc_status}})
        AND (COALESCE({{params.search}}, '') = '' OR p.name ILIKE {{ '%' + params.search + '%' }} OR p.sku ILIKE {{ '%' + params.search + '%' }} OR pb.batch_number ILIKE {{ '%' + params.search + '%' }})
      ORDER BY p.name ASC, pb.manufacture_date ASC
    `,
  });
}

export default listInventory;
