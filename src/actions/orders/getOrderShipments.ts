import { action } from '@uibakery/data';

export function getOrderShipments() {
  return action('getOrderShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so2.id,
        so2.origin,
        so2.carrier,
        so2.tracking_number,
        so2.shipped_date,
        so2.delivered_date,
        so2.status,
        so2.internal_shipping_cost_usd,
        so2.payable_status,
        so2.issue_flag,
        so2.issue_notes,
        w.name AS warehouse_name,
        f.name AS factory_name,
        (SELECT COUNT(*) FROM shipments_outbound_items soi WHERE soi.shipment_id = so2.id) AS item_count
      FROM shipments_outbound so2
      LEFT JOIN warehouses w ON w.id = so2.origin_warehouse_id
      LEFT JOIN factories f ON f.id = so2.factory_id
      WHERE so2.sales_order_id = {{params.orderId}}::bigint
      ORDER BY so2.shipped_date DESC
    `,
  });
}

export default getOrderShipments;
