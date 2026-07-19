import { action } from '@uibakery/data';
function listWarehouses() {
  return action('listWarehouseSettings', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT id, name, ship_from_name, city, state, country, address_line1, address_line2, '#' || postal_code AS postal_code, notes, is_active, ship_from_phone, (shippo_api_key IS NOT NULL) AS has_shippo_key FROM warehouses ORDER BY name ASC`,
  });
}
export default listWarehouses;
