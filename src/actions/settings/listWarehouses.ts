import { action } from '@uibakery/data';
function listWarehouses() {
  return action('listWarehouseSettings', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT id, name, city, state, country, address_line1, address_line2, postal_code, notes, is_active FROM warehouses ORDER BY name ASC`,
  });
}
export default listWarehouses;
