import { action } from '@uibakery/data';

export function listCustomers() {
  return action('listCustomers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.preferred_channel,
        c.channel_handle,
        c.is_vip,
        c.is_blocked,
        c.blocked_reason,
        c.created_at,
        COUNT(so.id) AS total_orders,
        COALESCE(SUM(so.total_usd), 0) AS lifetime_value,
        MAX(so.order_date) AS last_order_date
      FROM customers c
      LEFT JOIN sales_orders so ON so.customer_id = c.id
      WHERE
        (COALESCE({{params.search}}, '') = ''
          OR c.full_name ILIKE {{ '%' + params.search + '%' }}
          OR c.email ILIKE {{ '%' + params.search + '%' }}
          OR c.phone ILIKE {{ '%' + params.search + '%' }}
          OR c.channel_handle ILIKE {{ '%' + params.search + '%' }}
        )
        AND (COALESCE({{params.channel}}, '') = '' OR c.preferred_channel = {{params.channel}})
        AND ({{params.isVip}} IS NULL OR c.is_vip = {{params.isVip}}::boolean)
        AND ({{params.isBlocked}} IS NULL OR c.is_blocked = {{params.isBlocked}}::boolean)
      GROUP BY c.id
      ORDER BY c.full_name
      LIMIT 200
    `,
  });
}

export default listCustomers;
