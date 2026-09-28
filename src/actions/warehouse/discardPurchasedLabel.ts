import { action } from '@uibakery/data';

/**
 * Drop the app's reference to a persisted label purchase (Unlink label /
 * Discard label reference in Mark Shipped). Only the reference is
 * dropped — voiding the label for a refund happens on Shippo's side.
 * Consumed labels are untouchable: they belong to a recorded shipment.
 */
function discardPurchasedLabel() {
  return action('discardPurchasedLabel', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE purchased_labels
      SET discarded_at = now()
      WHERE id = {{params.label_id}}::bigint
        AND consumed_at IS NULL
      RETURNING id
    `,
  });
}

export default discardPurchasedLabel;
