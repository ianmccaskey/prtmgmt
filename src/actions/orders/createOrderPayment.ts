import { action } from '@uibakery/data';

/**
 * Single-statement insert; callers chain recomputePaymentStatus after
 * (multi-statement queries can't run as prepared statements).
 *
 * Inserts nothing (empty RETURNING) when the TX hash is already credited to
 * another live incoming payment of the same asset and network: one receipt
 * can't pay twice, e.g. a delivery a swap already settled. Asset and network
 * are part of the identity because one TX can legitimately move several
 * tokens. A payment without a hash is never refused. Hashes are stored
 * trimmed and compared trimmed and case-insensitively, the same identity the
 * order_payments_receipt_uniq index enforces against concurrent writers.
 */
export function createOrderPayment() {
  return action('createOrderPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO order_payments (
        sales_order_id, direction, asset, network, receive_wallet_id,
        quoted_at, spot_rate_usd, amount_asset, amount_usd,
        tx_hash, verification_status, verified_at, verified_by_user_id
      )
      SELECT
        {{params.orderId}}::bigint,
        'incoming',
        {{params.asset}},
        {{params.network}},
        {{params.walletId}}::bigint,
        NOW(),
        {{params.spotRateUsd}}::numeric,
        {{params.amountAsset}}::numeric,
        {{params.amountUsd}}::numeric,
        NULLIF(BTRIM({{params.txHash}}), ''),
        CASE WHEN {{params.verified}}::boolean THEN 'verified' ELSE 'pending' END,
        CASE WHEN {{params.verified}}::boolean THEN NOW() ELSE NULL END,
        CASE WHEN {{params.verified}}::boolean THEN {{params.userId}}::bigint ELSE NULL END
      WHERE NOT EXISTS (
        SELECT 1 FROM order_payments o2
        WHERE o2.direction = 'incoming' AND o2.verification_status <> 'failed'
          AND o2.asset = {{params.asset}} AND o2.network = {{params.network}}
          AND LOWER(BTRIM(o2.tx_hash)) = LOWER(NULLIF(BTRIM({{params.txHash}}), ''))
      )
      RETURNING id, sales_order_id
    `,
  });
}

export default createOrderPayment;
