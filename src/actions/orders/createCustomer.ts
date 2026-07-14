import { action } from '@uibakery/data';

export function createCustomer() {
  return action('createCustomer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO customers (
        full_name, email, phone, preferred_channel, channel_handle,
        ship_address_line1, ship_address_line2, ship_city, ship_state, ship_postal_code, ship_country,
        is_vip, notes, internal_notes
      ) VALUES (
        {{params.fullName}},
        {{params.email}},
        {{params.phone}},
        {{params.preferredChannel}},
        {{params.channelHandle}},
        {{params.shipAddressLine1}},
        {{params.shipAddressLine2}},
        {{params.shipCity}},
        {{params.shipState}},
        {{params.shipPostalCode}},
        {{params.shipCountry}},
        {{params.isVip}}::boolean,
        {{params.notes}},
        {{params.internalNotes}}
      )
      RETURNING id, full_name
    `,
  });
}

export default createCustomer;
