import { action } from '@uibakery/data';

export function markRefundSent() {
  return action('markRefundSent', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH payment AS (
        INSERT INTO order_payments (
          sales_order_id, direction, asset, network,
          quoted_at, spot_rate_usd, amount_asset, amount_usd,
          tx_hash, verification_status
        )
        SELECT
          rt.sales_order_id, 'refund', {{params.asset}}, {{params.network}},
          NOW(), {{params.spotRateUsd}}::numeric, {{params.amountAsset}}::numeric, {{params.amountUsd}}::numeric,
          {{params.txHash}}, 'pending'
        FROM refund_tasks rt WHERE rt.id = {{params.taskId}}::bigint
        RETURNING id
      )
      UPDATE refund_tasks
      SET status = 'sent',
          sent_at = NOW(),
          linked_payment_id = (SELECT id FROM payment)
      WHERE id = {{params.taskId}}::bigint
    `,
  });
}

export default markRefundSent;
