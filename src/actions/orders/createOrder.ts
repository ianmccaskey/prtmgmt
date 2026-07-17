import { action } from '@uibakery/data';

export function createOrder() {
  return action('createOrder', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO sales_orders (
        order_number, customer_id, order_date, created_by_user_id, sales_rep_user_profile_id,
        ship_to_name, ship_address_line1, ship_address_line2,
        ship_city, ship_state, ship_postal_code, ship_country,
        order_channel, is_free_order, free_order_reason_id, free_order_note,
        partial_fulfillment_allowed, status,
        subtotal_usd, customer_shipping_charge_usd, discount_usd, total_usd,
        payment_status, notes, preferred_warehouse_id
      ) VALUES (
        'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('sales_order_seq')::text, 4, '0'),
        {{params.customerId}}::bigint,
        CURRENT_DATE,
        {{params.createdByUserId}},
        {{params.salesRepUserProfileId}}::bigint,
        {{params.shipToName}},
        {{params.shipAddressLine1}},
        {{params.shipAddressLine2}},
        {{params.shipCity}},
        {{params.shipState}},
        {{params.shipPostalCode}},
        {{params.shipCountry}},
        {{params.orderChannel}},
        {{params.isFreeOrder}}::boolean,
        {{params.freeOrderReasonId}},
        {{params.freeOrderNote}},
        {{params.partialFulfillmentAllowed}}::boolean,
        -- Confirmation is payment-gated. At creation nothing is verified
        -- yet, so 'confirmed' is only honored for free/$0 orders (their
        -- payment_status derives straight to 'paid'); everything else is
        -- forced to 'quote' regardless of what the client sent.
        CASE
          WHEN {{params.status}} = 'confirmed'
            AND ({{params.isFreeOrder}}::boolean = true OR {{params.totalUsd}}::numeric = 0)
          THEN 'confirmed'
          ELSE 'quote'
        END,
        {{params.subtotalUsd}}::numeric,
        {{params.customerShippingChargeUsd}}::numeric,
        {{params.discountUsd}}::numeric,
        {{params.totalUsd}}::numeric,
        'unpaid',
        {{params.notes}},
        {{params.preferredWarehouseId}}::bigint
      )
      RETURNING id, order_number
    `,
  });
}

export default createOrder;
