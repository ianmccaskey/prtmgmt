import { action } from '@uibakery/data';

/** Flip a line between warehouse and china_direct. Guarded: unshipped/unallocated lines only. */
export function switchItemSource() {
  return action('switchItemSource', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_order_items soi
      SET fulfillment_source = {{params.source}},
          preferred_batch_id = CASE WHEN {{params.source}} = 'warehouse' THEN soi.preferred_batch_id ELSE NULL END,
          preferred_warehouse_id = CASE WHEN {{params.source}} = 'warehouse' THEN soi.preferred_warehouse_id ELSE NULL END
      WHERE soi.id = {{params.itemId}}::bigint
        AND NOT EXISTS (SELECT 1 FROM sales_order_item_allocations a WHERE a.sales_order_item_id = soi.id)
      RETURNING soi.id, soi.product_id, soi.quantity
    `,
  });
}

export default switchItemSource;
