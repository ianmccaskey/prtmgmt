import { action } from '@uibakery/data';

/**
 * Ship-from address + Shippo credentials per active warehouse, for label
 * purchasing in the Mark Shipped dialog. Postal code carries the '#' guard
 * (client numeric parsing) — strip with dbText().
 */
function listWarehouseShipFrom() {
  return action('listWarehouseShipFrom', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, name, ship_from_name, address_line1, address_line2,
        city, state, '#' || postal_code AS postal_code, country,
        ship_from_phone, shippo_api_key
      FROM warehouses
      WHERE is_active = true
    `,
  });
}

export default listWarehouseShipFrom;
