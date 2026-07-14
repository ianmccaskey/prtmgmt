import { action } from '@uibakery/data';

export function getOrdersByChannel() {
  return action('getOrdersByChannel', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        COALESCE(order_channel, 'other') AS channel,
        COUNT(*) AS count
      FROM sales_orders
      WHERE DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY order_channel
      ORDER BY count DESC
    `,
  });
}

export default getOrdersByChannel;
