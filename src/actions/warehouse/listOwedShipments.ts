import { action } from '@uibakery/data';

function listOwedShipments() {
  return action('listOwedShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id, so.sales_order_id, so.shipped_date, so.internal_shipping_cost_usd,
        so.carrier, so.tracking_number, so.payable_status,
        sales.order_number,
        COALESCE(SUM(soi.quantity_shipped), 0) AS total_kits
      FROM shipments_outbound so
      LEFT JOIN sales_orders sales ON sales.id = so.sales_order_id
      LEFT JOIN shipments_outbound_items soi ON soi.shipment_id = so.id
      WHERE so.origin_warehouse_id = {{params.warehouse_id}}
        AND so.payable_status = 'owed'
      GROUP BY so.id, sales.order_number
      ORDER BY so.shipped_date DESC
    `,
  });
}

export default listOwedShipments;
