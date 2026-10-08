import { action } from '@uibakery/data';

function listWarehouseCommissionShipments() {
  return action('listWarehouseCommissionShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS shipment_id, so.sales_order_id, sales.order_number,
        so.shipped_date, so.carrier, '#' || so.tracking_number AS tracking_number,
        so.internal_shipping_cost_usd,
        -- Expedited fee shown on the shipment that carries it (the order's
        -- first warehouse-origin shipment) so the payout math is visible.
        CASE WHEN sales.shipping_fee_recipient = 'warehouse'
              AND COALESCE(sales.customer_shipping_charge_usd, 0) > 0
              AND sales.status NOT IN ('cancelled', 'quote')
              AND so.id = (SELECT MIN(sh2.id) FROM shipments_outbound sh2
                           WHERE sh2.sales_order_id = sales.id AND sh2.origin = 'warehouse')
             THEN sales.customer_shipping_charge_usd END AS expedited_fee_usd,
        w.id AS warehouse_id, w.name AS warehouse_name,
        COALESCE(SUM(soi.quantity_shipped), 0) AS total_kits
      FROM shipments_outbound so
      JOIN warehouses w ON w.id = so.origin_warehouse_id
      LEFT JOIN sales_orders sales ON sales.id = so.sales_order_id
      LEFT JOIN shipments_outbound_items soi ON soi.shipment_id = so.id
      WHERE so.origin = 'warehouse'
        -- A row earns its place by rate-plan cost OR by carrying a routed
        -- expedited fee — a fee-only shipment must not vanish from the
        -- drilldown while the balance math counts it.
        AND (so.internal_shipping_cost_usd IS NOT NULL
          OR (sales.shipping_fee_recipient = 'warehouse'
              AND COALESCE(sales.customer_shipping_charge_usd, 0) > 0
              AND sales.status NOT IN ('cancelled', 'quote')
              AND so.id = (SELECT MIN(sh2.id) FROM shipments_outbound sh2
                           WHERE sh2.sales_order_id = sales.id AND sh2.origin = 'warehouse')))
        AND ({{params.warehouse_id}} IS NULL OR w.id = {{params.warehouse_id}}::bigint)
        AND ({{params.date_from}} IS NULL OR so.shipped_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.shipped_date <= {{params.date_to}}::date)
      GROUP BY so.id, sales.id, sales.order_number, w.id, w.name
      ORDER BY so.shipped_date DESC
    `,
  });
}

export default listWarehouseCommissionShipments;
