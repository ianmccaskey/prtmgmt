import { action } from '@uibakery/data';

export function getChinaDirectStats() {
  return action('getChinaDirectStats', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COUNT(DISTINCT so.id) FROM sales_orders so
          JOIN sales_order_items soi ON soi.sales_order_id = so.id
          WHERE soi.fulfillment_source = 'china_direct' AND so.status = 'confirmed') AS awaiting_production,
        (SELECT COUNT(DISTINCT so.id) FROM sales_orders so
          JOIN sales_order_items soi ON soi.sales_order_id = so.id
          WHERE soi.fulfillment_source = 'china_direct' AND so.status = 'in_production') AS in_production,
        (SELECT COUNT(*) FROM shipments_outbound
          WHERE origin = 'china'
          AND DATE_TRUNC('month', shipped_date) = DATE_TRUNC('month', CURRENT_DATE)) AS shipped_china_this_month
    `,
  });
}

export default getChinaDirectStats;
