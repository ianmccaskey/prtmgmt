import { action } from '@uibakery/data';

export function searchCustomers() {
  return action('searchCustomers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        id, full_name, email, phone, preferred_channel, channel_handle,
        is_vip, is_blocked, blocked_reason,
        ship_address_line1, ship_address_line2, ship_city, ship_state, ship_postal_code, ship_country
      FROM customers
      WHERE
        full_name ILIKE {{ '%' + params.q + '%' }}
        OR email ILIKE {{ '%' + params.q + '%' }}
        OR phone ILIKE {{ '%' + params.q + '%' }}
        OR channel_handle ILIKE {{ '%' + params.q + '%' }}
      ORDER BY full_name
      LIMIT 10
    `,
  });
}

export default searchCustomers;
