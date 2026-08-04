import { action } from '@uibakery/data';

/**
 * Edit a receive address (all label/address/contact fields; '' clears
 * optionals). Deliberately NO used-lock (unlike wallets): receive
 * addresses are operational aliases — a typo fix or phone addition should
 * flow through everywhere, including historical shipment displays, which
 * join this table live.
 */
function updateReceiveAddress() {
  return action('updateReceiveAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE warehouse_receive_addresses SET
        label = {{params.label}},
        address_name = NULLIF({{params.address_name}}::text, ''),
        address_line1 = {{params.address_line1}},
        address_line2 = NULLIF({{params.address_line2}}::text, ''),
        city = NULLIF({{params.city}}::text, ''),
        state = NULLIF({{params.state}}::text, ''),
        postal_code = NULLIF({{params.postal_code}}::text, ''),
        country = COALESCE(NULLIF({{params.country}}::text, ''), 'US'),
        phone = NULLIF({{params.phone}}::text, ''),
        notes = NULLIF({{params.notes}}::text, '')
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}

export default updateReceiveAddress;
