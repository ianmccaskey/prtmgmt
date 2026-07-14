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
      UPDATE sales_orders
      SET status = CASE
        WHEN EXISTS(SELECT 1 FROM sales_order_items WHERE sales_order_id = {{params.orderId}}::bigint AND fulfillment_source = 'warehouse')
        THEN 'partially_shipped'
        ELSE 'shipped'
      END
      WHERE id = {{params.orderId}}::bigint
    `,
  });
}

export default markShippedFromChina;
