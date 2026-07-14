import { action } from '@uibakery/data';

export function updateOrderShipTo() {
  return action('updateOrderShipTo', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders SET
        ship_to_name = {{params.shipToName}},
        ship_address_line1 = {{params.line1}},
        ship_address_line2 = {{params.line2}},
        ship_city = {{params.city}},
        ship_state = {{params.state}},
        ship_postal_code = {{params.postal}},
        ship_country = {{params.country}}
      WHERE id = {{params.orderId}}::bigint
        AND status NOT IN ('cancelled', 'delivered')
      RETURNING id
    `,
  });
}

export default updateOrderShipTo;
