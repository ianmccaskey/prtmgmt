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
        tx_hash, verification_status
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
        'pending'
      )
      RETURNING id, sales_order_id
    `,
  });
}

export default createOrderPayment;
