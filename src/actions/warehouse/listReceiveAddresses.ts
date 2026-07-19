import { action } from '@uibakery/data';

/** Receive addresses, optionally filtered to one warehouse. */
function listReceiveAddresses() {
  return action('listReceiveAddresses', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT ra.id, ra.warehouse_id, ra.label, ra.address_name, ra.address_line1, ra.address_line2,
             ra.city, ra.state, '#' || ra.postal_code AS postal_code, ra.country, ra.is_active, ra.notes,
             w.name AS warehouse_name
      FROM warehouse_receive_addresses ra
      JOIN warehouses w ON w.id = ra.warehouse_id
      WHERE (COALESCE({{params.warehouse_id}}, '') = '' OR ra.warehouse_id::text = {{params.warehouse_id}})
      ORDER BY w.name ASC, ra.label ASC
    `,
  });
}

export default listReceiveAddresses;
