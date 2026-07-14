import { action } from '@uibakery/data';

export function markShippedFromChina() {
  return action('markShippedFromChina', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH new_shipment AS (
        INSERT INTO shipments_outbound (
          sales_order_id, origin, factory_id, carrier, tracking_number, shipped_date, status, payable_status
        ) VALUES (
          {{params.orderId}}::bigint,
          'china',
          {{params.factoryId}},
          {{params.carrier}},
          {{params.trackingNumber}},
          {{params.shippedDate}}::date,
          'in_transit',
          'owed'
        ) RETURNING id
      )
      , notification AS (
        INSERT INTO notifications_sent (sales_order_id, shipment_id, channel, recipient, subject, body, status)
        SELECT so.id, ns.id, 'email', c.email,
          'Your order ' || so.order_number || ' has shipped',
          'Carrier: ' || COALESCE({{params.carrier}}, '—') || E'\\nTracking: ' || COALESCE({{params.trackingNumber}}, '—'),
          'pending'
        FROM new_shipment ns
        JOIN sales_orders so ON so.id = {{params.orderId}}::bigint
        JOIN customers c ON c.id = so.customer_id
      )
      UPDATE sales_orders
      SET status = CASE
        WHEN EXISTS(
          SELECT 1 FROM sales_order_items soi
          LEFT JOIN (
            SELECT sales_order_item_id, SUM(quantity) AS q
            FROM sales_order_item_allocations GROUP BY sales_order_item_id
          ) a ON a.sales_order_item_id = soi.id
          WHERE soi.sales_order_id = {{params.orderId}}::bigint
            AND soi.fulfillment_source = 'warehouse'
            AND COALESCE(a.q, 0) < soi.quantity
        )
        THEN 'partially_shipped'
        ELSE 'shipped'
      END
      WHERE id = {{params.orderId}}::bigint
    `,
  });
}

export default markShippedFromChina;
