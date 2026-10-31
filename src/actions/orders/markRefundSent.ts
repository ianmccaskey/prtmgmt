import { action } from '@uibakery/data';

export function markRefundSent() {
  return action('markRefundSent', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH pick AS (
        SELECT rt.sales_order_id,
          -- The receive wallet the refund left from, so that wallet's
          -- on-chain check nets it. Re-validated here: active, same
          -- asset/network, and the order's money division (its primary
          -- rep's). Null walletId = "sent from another wallet": no link,
          -- and the refund lands on the wallet check's unassigned line.
          (SELECT rw.id FROM receive_wallets rw
           WHERE rw.id = NULLIF({{params.walletId}}::text, '')::bigint
             AND rw.is_active = true
             AND rw.asset = {{params.asset}}
             AND rw.network = {{params.network}}
             AND rw.division = COALESCE(rp.division, 'us')) AS wallet_id
        FROM refund_tasks rt
        JOIN sales_orders so ON so.id = rt.sales_order_id
        LEFT JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
        WHERE rt.id = {{params.taskId}}::bigint
      ),
      payment AS (
        INSERT INTO order_payments (
          sales_order_id, direction, asset, network, receive_wallet_id,
          quoted_at, spot_rate_usd, amount_asset, amount_usd,
          tx_hash, verification_status
        )
        SELECT
          p.sales_order_id, 'refund', {{params.asset}}, {{params.network}}, p.wallet_id,
          NOW(), {{params.spotRateUsd}}::numeric, {{params.amountAsset}}::numeric, {{params.amountUsd}}::numeric,
          {{params.txHash}}, 'pending'
        FROM pick p
        -- A wallet that was asked for but no longer qualifies (deactivated,
        -- other division, asset/network changed) refuses the whole save
        -- rather than quietly recording the refund unlinked.
        WHERE NULLIF({{params.walletId}}::text, '') IS NULL OR p.wallet_id IS NOT NULL
        RETURNING id
      )
      UPDATE refund_tasks
      SET status = 'sent',
          sent_at = NOW(),
          linked_payment_id = (SELECT id FROM payment)
      WHERE id = {{params.taskId}}::bigint
        AND EXISTS (SELECT 1 FROM payment)
      RETURNING id
    `,
  });
}

export default markRefundSent;
