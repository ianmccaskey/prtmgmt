import { action } from '@uibakery/data';

function getPaymentMethodBreakdown() {
  return action('getPaymentMethodBreakdown', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        op.asset,
        op.network,
        op.asset || '/' || op.network AS asset_network,
        COUNT(*) AS tx_count,
        SUM(op.amount_usd) AS total_usd,
        AVG(op.amount_usd) AS avg_usd
      FROM order_payments op
      JOIN sales_orders so ON so.id = op.sales_order_id
      WHERE op.verification_status = 'verified'
        AND op.direction = 'inbound'
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
      GROUP BY op.asset, op.network
      ORDER BY total_usd DESC
    `,
  });
}

export default getPaymentMethodBreakdown;
