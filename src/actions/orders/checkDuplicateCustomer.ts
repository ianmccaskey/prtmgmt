import { action } from '@uibakery/data';

export function checkDuplicateCustomer() {
  return action('checkDuplicateCustomer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, full_name, email, phone, ship_address_line1, ship_city, ship_state,
        (SELECT MAX(order_date) FROM sales_orders WHERE customer_id = c.id) AS last_order_date
      FROM customers c
      WHERE TRIM(LOWER(full_name)) = TRIM(LOWER({{params.fullName}}))
        AND TRIM(LOWER(ship_address_line1)) = TRIM(LOWER({{params.shipAddressLine1}}))
    `,
  });
}

export default checkDuplicateCustomer;
