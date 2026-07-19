import { action } from '@uibakery/data';

function createOutboundShipment() {
  return action('createOutboundShipment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO shipments_outbound (
        sales_order_id, origin, origin_warehouse_id, carrier, tracking_number,
        shipped_date, status, internal_shipping_cost_usd, rate_plan_id, payable_status,
        label_url, shippo_transaction_id, label_cost_usd
      ) VALUES (
        {{params.order_id}}::bigint,
        'warehouse',
        {{params.warehouse_id}}::bigint,
        {{params.carrier}},
        {{params.tracking_number}},
        CURRENT_DATE,
        'in_transit',
        {{params.cost_usd}}::numeric,
        {{params.rate_plan_id}},
        'owed',
        {{params.label_url}}::text,
        {{params.shippo_transaction_id}}::text,
        {{params.label_cost_usd}}::numeric
      )
      RETURNING id
    `,
  });
}

export default createOutboundShipment;
