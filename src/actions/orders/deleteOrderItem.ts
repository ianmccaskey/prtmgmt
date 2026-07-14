import { action } from '@uibakery/data';

/** Remove an unshipped line. Guarded: no-op once any allocation exists. */
export function deleteOrderItem() {
  return action('deleteOrderItem', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM sales_order_items soi
      WHERE soi.id = {{params.itemId}}::bigint
        AND NOT EXISTS (SELECT 1 FROM sales_order_item_allocations a WHERE a.sales_order_item_id = soi.id)
      RETURNING soi.id, soi.product_id, soi.quantity
    `,
  });
}

export default deleteOrderItem;
