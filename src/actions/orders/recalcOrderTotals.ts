import { action } from '@uibakery/data';
import { paymentRollupSql } from './paymentRollupSql';

/**
 * Recompute subtotal/total from current line items plus the supplied
 * discount/shipping (pass the existing values when unchanged), then re-derive
 * payment_status against the new total.
 */
export function recalcOrderTotals() {
  return action('recalcOrderTotals', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders so
      SET subtotal_usd = sub.subtotal,
          discount_usd = {{params.discountUsd}}::numeric,
          customer_shipping_charge_usd = {{params.shippingUsd}}::numeric,
          total_usd = GREATEST(0, sub.subtotal - {{params.discountUsd}}::numeric + {{params.shippingUsd}}::numeric)
      FROM (
        SELECT COALESCE(SUM(line_total_usd), 0) AS subtotal
        FROM sales_order_items WHERE sales_order_id = {{params.orderId}}::bigint
      ) sub
      WHERE so.id = {{params.orderId}}::bigint;
${paymentRollupSql('{{params.orderId}}::bigint')};
    `,
  });
}

export default recalcOrderTotals;
