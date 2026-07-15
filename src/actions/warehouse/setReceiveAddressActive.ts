import { action } from '@uibakery/data';

/** Deactivating hides an address from new-shipment pickers; history keeps pointing at it. */
function setReceiveAddressActive() {
  return action('setReceiveAddressActive', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE warehouse_receive_addresses
      SET is_active = {{params.is_active}}
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}

export default setReceiveAddressActive;
