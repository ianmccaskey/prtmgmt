import { action } from '@uibakery/data';

function listWarehouseCommissionShipments() {
  return action('listWarehouseCommissionShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS shipment_id, so.sales_order_id, sales.order_number,
        so.shipped_date, so.carrier, so.internal_shipping_cost_usd,
        w.id AS warehouse_id, w.name AS warehouse_name,
        COALESCE(SUM(soi.quantity_shipped), 0) AS total_kits
      FROM shipments_outbound so
      JOIN warehouses w ON w.id = so.origin_warehouse_id
      LEFT JOIN sales_orders sales ON sales.id = so.sales_order_id
      LEFT JOIN shipments_outbound_items soi ON soi.shipment_id = so.id
      WHERE so.origin = 'warehouse' AND so.internal_shipping_cost_usd IS NOT NULL
        AND ({{params.warehouse_id}} IS NULL OR w.id = {{params.warehouse_id}}::bigint)
        AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
      GROUP BY so.id, sales.order_number, w.id, w.name
      ORDER BY so.shipped_date DESC
    `,
  });
}

export default listWarehouseCommissionShipments;
