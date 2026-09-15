import { action } from '@uibakery/data';

/**
 * Edit a warehouse's name, ship-from address, and notes. The ship-from
 * address feeds label purchases (Shippo) and inbound-shipment defaults,
 * so fixing a typo here fixes every future label.
 */
function updateWarehouse() {
  return action('updateWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE warehouses SET
        name = {{params.name}},
        ship_from_name = {{params.ship_from_name}},
        city = {{params.city}},
        state = {{params.state}},
        country = {{params.country}},
        address_line1 = {{params.address_line1}},
        address_line2 = {{params.address_line2}},
        postal_code = {{params.postal_code}},
        notes = {{params.notes}}
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}

export default updateWarehouse;
