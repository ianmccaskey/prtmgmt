import { action } from '@uibakery/data';

/**
 * Tie a persisted label purchase to the shipment that recorded it, so it
 * stops rehydrating in Mark Shipped. Failure here is non-fatal by design:
 * listPurchasedLabels also hides labels whose tracking number already
 * exists on one of the order's shipments.
 */
function consumePurchasedLabel() {
  return action('consumePurchasedLabel', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE purchased_labels
      SET consumed_at = now(),
          consumed_shipment_id = NULLIF({{params.shipment_id}}, '')::bigint
      WHERE id = {{params.label_id}}::bigint
        AND consumed_at IS NULL
      RETURNING id
    `,
  });
}

export default consumePurchasedLabel;
