import { action } from '@uibakery/data';

/** Edit an unshipped line's quantity/price. Guarded: no-op once any allocation exists (shipped lines are locked). */
export function updateOrderItemQtyPrice() {
  return action('updateOrderItemQtyPrice', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_order_items soi
      SET quantity = {{params.quantity}}::int,
          unit_price_usd = {{params.unitPriceUsd}}::numeric,
          line_total_usd = {{params.quantity}}::int * {{params.unitPriceUsd}}::numeric
      WHERE soi.id = {{params.itemId}}::bigint
        AND NOT EXISTS (SELECT 1 FROM sales_order_item_allocations a WHERE a.sales_order_item_id = soi.id)
      RETURNING soi.id
    `,
  });
}

export default updateOrderItemQtyPrice;
