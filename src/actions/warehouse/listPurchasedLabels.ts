import { action } from '@uibakery/data';

/**
 * Open (unconsumed, undiscarded) label purchases for an order — what the
 * Mark Shipped dialog rehydrates on open so a paid label survives
 * navigation. The NOT EXISTS belt hides a label whose tracking number
 * already sits on one of this order's shipments: if the consume step ever
 * fails after the shipment was created, the label must not resurrect as
 * "unused" and invite a double shipment.
 */
function listPurchasedLabels() {
  return action('listPurchasedLabels', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT pl.id, pl.origin_warehouse_id, pl.carrier, pl.tracking_number,
             pl.label_url, pl.shippo_transaction_id, pl.label_cost_usd,
             pl.kits, pl.purchased_at
      FROM purchased_labels pl
      WHERE pl.sales_order_id = {{params.order_id}}::bigint
        AND pl.consumed_at IS NULL
        AND pl.discarded_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM shipments_outbound sh
          WHERE sh.sales_order_id = pl.sales_order_id
            AND sh.tracking_number = pl.tracking_number
        )
      ORDER BY pl.purchased_at DESC
    `,
  });
}

export default listPurchasedLabels;
