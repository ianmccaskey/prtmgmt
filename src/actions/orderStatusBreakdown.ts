import { action } from '@uibakery/data';

export function getOrderStatusBreakdown() {
  return action('getOrderStatusBreakdown', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT status, COUNT(*) AS count
      FROM sales_orders
      GROUP BY status
      ORDER BY count DESC
    `,
  });
}

export default getOrderStatusBreakdown;
