import { action } from '@uibakery/data';

export function updateCustomer() {
  return action('updateCustomer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE customers SET
        full_name = {{params.fullName}},
        email = {{params.email}},
        phone = {{params.phone}},
        preferred_channel = {{params.preferredChannel}},
        channel_handle = {{params.channelHandle}},
        is_vip = {{params.isVip}}::boolean,
        ship_address_line1 = {{params.shipAddressLine1}},
        ship_address_line2 = {{params.shipAddressLine2}},
        ship_city = {{params.shipCity}},
        ship_state = {{params.shipState}},
        ship_postal_code = {{params.shipPostalCode}},
        ship_country = {{params.shipCountry}},
        notes = {{params.notes}},
        internal_notes = {{params.internalNotes}}
      WHERE id = {{params.customerId}}::bigint
    `,
  });
}

export default updateCustomer;
