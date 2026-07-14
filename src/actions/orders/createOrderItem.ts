import { action } from '@uibakery/data';

export function createOrderItem() {
  return action('createOrderItem', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO sales_order_items (
        sales_order_id, product_id, quantity, unit_price_usd, line_total_usd, fulfillment_source
      ) VALUES (
        {{params.orderId}}::bigint,
        {{params.productId}}::bigint,
        {{params.quantity}}::integer,
        {{params.unitPriceUsd}}::numeric,
        {{params.lineTotalUsd}}::numeric,
        {{params.fulfillmentSource}}
      )
    `,
  });
}

export default createOrderItem;
