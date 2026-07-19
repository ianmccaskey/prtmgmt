import { action } from '@uibakery/data';

/**
 * Single-statement insert; callers chain recomputePaymentStatus after
 * (multi-statement queries can't run as prepared statements).
 */
export function createOrderPayment() {
  return action('createOrderPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO order_payments (
        sales_order_id, direction, asset, network, receive_wallet_id,
        quoted_at, spot_rate_usd, amount_asset, amount_usd,
        tx_hash, verification_status, verified_at, verified_by_user_id
      ) VALUES (
        {{params.orderId}}::bigint,
        'incoming',
        {{params.asset}},
        {{params.network}},
        {{params.walletId}},
        NOW(),
        {{params.spotRateUsd}}::numeric,
        {{params.amountAsset}}::numeric,
        {{params.amountUsd}}::numeric,
        {{params.txHash}},
        CASE WHEN {{params.verified}}::boolean THEN 'verified' ELSE 'pending' END,
        CASE WHEN {{params.verified}}::boolean THEN NOW() ELSE NULL END,
        CASE WHEN {{params.verified}}::boolean THEN {{params.userId}}::bigint ELSE NULL END
      )
      RETURNING id, sales_order_id
    `,
  });
}

export default createOrderPayment;
