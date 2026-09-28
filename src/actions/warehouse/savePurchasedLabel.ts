import { action } from '@uibakery/data';

/**
 * Persist a Shippo label purchase the moment it succeeds, BEFORE the
 * shipment exists. Real money was just spent; if the user navigates away
 * from Mark Shipped before confirming, this row is what lets the dialog
 * restore the label instead of stranding it (ORD-2026-0268).
 *
 * The label_url scheme allowlist mirrors updateShipmentLabel: the URL
 * renders into an href, so only web URLs and upload data: types may land
 * here. An out-of-allowlist URL stores NULL (the tracking number is the
 * essential recovery datum), never a clickable payload.
 */
function savePurchasedLabel() {
  return action('savePurchasedLabel', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO purchased_labels
        (sales_order_id, origin_warehouse_id, carrier, tracking_number,
         label_url, shippo_transaction_id, label_cost_usd, kits, purchased_by_user_id)
      VALUES (
        {{params.order_id}}::bigint,
        {{params.warehouse_id}}::bigint,
        NULLIF({{params.carrier}}, ''),
        {{params.tracking_number}},
        CASE WHEN {{params.label_url}} LIKE 'https://%'
          OR {{params.label_url}} LIKE 'http://%'
          OR {{params.label_url}} LIKE 'data:application/pdf%'
          OR {{params.label_url}} LIKE 'data:image/%'
          THEN {{params.label_url}} END,
        NULLIF({{params.transaction_id}}, ''),
        NULLIF({{params.cost}}, '')::numeric,
        NULLIF({{params.kits}}, '')::int,
        NULLIF({{params.user_id}}, '')::bigint
      )
      RETURNING id
    `,
  });
}

export default savePurchasedLabel;
