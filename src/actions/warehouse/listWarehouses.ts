import { action } from '@uibakery/data';

function listWarehouses() {
  return action('listWarehouses', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT id, name, ship_from_name, city, address_line1, address_line2, state, postal_code, country, notes, is_active FROM warehouses ORDER BY name ASC`,
  });
}

export default listWarehouses;
