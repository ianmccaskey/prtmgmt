import { action } from '@uibakery/data';

function createReceiveAddress() {
  return action('createReceiveAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO warehouse_receive_addresses (
        warehouse_id, label, address_name, address_line1, address_line2,
        city, state, postal_code, country, notes
      ) VALUES (
        {{params.warehouse_id}}::bigint, {{params.label}}, {{params.address_name}}, {{params.address_line1}}, {{params.address_line2}},
        {{params.city}}, {{params.state}}, {{params.postal_code}}, {{params.country}}, {{params.notes}}
      )
      RETURNING id
    `,
  });
}

export default createReceiveAddress;
