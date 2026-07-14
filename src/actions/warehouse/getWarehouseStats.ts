import { action } from '@uibakery/data';

function getWarehouseStats() {
  return action('getWarehouseStats', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        COUNT(DISTINCT i.product_id) AS total_skus,
        COALESCE(SUM(i.quantity_on_hand), 0) AS total_kits,
        COALESCE(SUM(i.quantity_on_hand * p.list_price), 0) AS total_retail_value,
        COUNT(DISTINCT CASE WHEN prod_avail.total_available <= p.low_stock_threshold THEN p.id END) AS low_stock_count,
        COALESCE(SUM(i.quantity_reserved), 0) AS kits_reserved,
        COALESCE((
          SELECT SUM(sii.quantity_shipped - COALESCE(sii.quantity_received, 0))
          FROM shipments_inbound_items sii
          JOIN shipments_inbound si ON si.id = sii.shipment_id
          WHERE si.status != 'delivered'
            AND (COALESCE({{params.warehouse_id}}, '') = '' OR sii.destination_warehouse_id::text = {{params.warehouse_id}})
        ), 0) AS kits_in_transit_inbound,
        COALESCE((
          SELECT SUM(iwt.quantity)
          FROM inter_warehouse_transfers iwt
          WHERE iwt.status = 'initiated'
            AND (COALESCE({{params.warehouse_id}}, '') = '' OR iwt.destination_warehouse_id::text = {{params.warehouse_id}})
        ), 0) AS kits_in_transit_transfer
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN (
        SELECT product_id, SUM(quantity_on_hand - quantity_reserved) AS total_available
        FROM inventory GROUP BY product_id
      ) prod_avail ON prod_avail.product_id = p.id
      WHERE (COALESCE({{params.warehouse_id}}, '') = '' OR i.warehouse_id::text = {{params.warehouse_id}})
    `,
  });
}

export default getWarehouseStats;
