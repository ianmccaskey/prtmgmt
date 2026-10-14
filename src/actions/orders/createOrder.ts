import { action } from '@uibakery/data';

export function createOrder() {
  return action('createOrder', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO sales_orders (
        order_number, customer_id, order_date, created_by_user_id, sales_rep_user_profile_id,
        sales_rep_user_profile_id_2, rep_split_pct,
        ship_to_name, ship_address_line1, ship_address_line2,
        ship_city, ship_state, ship_postal_code, ship_country,
        order_channel, is_free_order, free_order_reason_id, free_order_note,
        partial_fulfillment_allowed, status,
        subtotal_usd, customer_shipping_charge_usd, shipping_fee_recipient, discount_usd, total_usd,
        payment_status, notes, warehouse_note, preferred_warehouse_id
      ) VALUES (
        'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('sales_order_seq')::text, 4, '0'),
        {{params.customerId}}::bigint,
        CURRENT_DATE,
        {{params.createdByUserId}},
        {{params.salesRepUserProfileId}}::bigint,
        -- Optional second rep + split (primary's share). The second rep is
        -- DROPPED (split forced 100) when missing, equal to the primary, or
        -- in a DIFFERENT DIVISION — the money pipelines are per division
        -- and the vendor's collected is primary-scoped, so a cross-division
        -- split would accrue commission in a division that never collected
        -- the money. Table CHECKs enforce the first two; the division rule
        -- lives here.
        -- EXISTS, not null-checks: a second rep is kept only when BOTH reps
        -- are real user_profiles rows (id = NULL matches nothing, so the
        -- EXISTS also covers an unassigned primary), distinct, and in the
        -- same division.
        CASE WHEN NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = {{params.salesRepUserProfileId}}::bigint)
               OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = NULLIF({{params.salesRepUserProfileId2}}, '')::bigint)
               OR NULLIF({{params.salesRepUserProfileId2}}, '')::bigint = {{params.salesRepUserProfileId}}::bigint
               OR COALESCE((SELECT division FROM user_profiles WHERE id = NULLIF({{params.salesRepUserProfileId2}}, '')::bigint), 'us')
                  <> COALESCE((SELECT division FROM user_profiles WHERE id = {{params.salesRepUserProfileId}}::bigint), 'us')
             THEN NULL
             ELSE NULLIF({{params.salesRepUserProfileId2}}, '')::bigint END,
        CASE WHEN NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = {{params.salesRepUserProfileId}}::bigint)
               OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = NULLIF({{params.salesRepUserProfileId2}}, '')::bigint)
               OR NULLIF({{params.salesRepUserProfileId2}}, '')::bigint = {{params.salesRepUserProfileId}}::bigint
               OR COALESCE((SELECT division FROM user_profiles WHERE id = NULLIF({{params.salesRepUserProfileId2}}, '')::bigint), 'us')
                  <> COALESCE((SELECT division FROM user_profiles WHERE id = {{params.salesRepUserProfileId}}::bigint), 'us')
             THEN 100
             ELSE LEAST(99, GREATEST(1, COALESCE(NULLIF({{params.repSplitPct}}, '')::numeric, 50))) END,
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
        -- Orders are ALWAYS born as quotes. Confirmation happens only
        -- through updateOrderStatus, whose single statement carries the
        -- gate, the payment derivation, and the audit row (2026-09
        -- hardening — the old free/$0 direct-confirm here skipped all
        -- three when the caller's chain died, ORD-2026-0257 class). The
        -- status param is ignored by design — a stale client sending
        -- 'confirmed' still gets a quote.
        'quote',
        {{params.subtotalUsd}}::numeric,
        {{params.customerShippingChargeUsd}}::numeric,
        -- 'vendor' = under-MOQ fee, 'warehouse' = expedited label fee.
        COALESCE(NULLIF({{params.shippingFeeRecipient}}, ''), 'vendor'),
        {{params.discountUsd}}::numeric,
        {{params.totalUsd}}::numeric,
        'unpaid',
        {{params.notes}},
        NULLIF({{params.warehouseNote}}, ''),
        {{params.preferredWarehouseId}}::bigint
      )
      RETURNING id, order_number
    `,
  });
}

export default createOrder;
