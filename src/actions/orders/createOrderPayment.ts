import { action } from '@uibakery/data';
import { paymentRollupSql } from './paymentRollupSql';

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
      );
${paymentRollupSql('{{params.orderId}}::bigint')};
    `,
  });
}

export default createOrderPayment;
