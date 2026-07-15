import { action } from '@uibakery/data';
function createWarehouse() {
  return action('createWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `INSERT INTO warehouses (name, ship_from_name, city, state, country, address_line1, address_line2, postal_code, notes, is_active) VALUES ({{params.name}}, {{params.ship_from_name}}, {{params.city}}, {{params.state}}, {{params.country}}, {{params.address_line1}}, {{params.address_line2}}, {{params.postal_code}}, {{params.notes}}, true) RETURNING id`,
  });
}
export default createWarehouse;
