import { action } from '@uibakery/data';

function getTopCustomers() {
  return action('getTopCustomers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        ROW_NUMBER() OVER (ORDER BY SUM(so.total_usd) DESC) AS rank,
        c.id AS customer_id,
        c.full_name,
        c.email,
        c.is_vip,
        COUNT(so.id) AS order_count,
        SUM(so.total_usd) AS total_spend,
        AVG(so.total_usd) AS avg_order_value,
        MAX(so.order_date) AS last_order_date
      FROM customers c
      JOIN sales_orders so ON so.customer_id = c.id
      WHERE so.status NOT IN ('cancelled','quote')
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY c.id
      ORDER BY total_spend DESC
      LIMIT {{params.top_n}}
    `,
  });
}

export default getTopCustomers;
