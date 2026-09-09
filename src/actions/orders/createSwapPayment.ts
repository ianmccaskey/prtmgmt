import { action } from '@uibakery/data';

/**
 * Records a Chainflip auto-swap payment: the customer sends plain BTC to a
 * unique deposit channel and USDC arrives at our Ethereum wallet. Created
 * PENDING with the estimated USDC amount — the swap sync (or the drawer's
 * Check Swap button) completes it with the real egress TX + amount once
 * the protocol delivers. Callers chain recomputePaymentStatus after.
 */
export function createSwapPayment() {
  return action('createSwapPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO order_payments (
        sales_order_id, direction, asset, network, receive_wallet_id,
        quoted_at, amount_asset, amount_usd, verification_status,
        swap_provider, swap_channel_id, swap_deposit_address, swap_expires_at, swap_state, swap_src_amount
      ) VALUES (
        {{params.orderId}}::bigint,
        'incoming',
        'USDC',
        'ethereum',
        {{params.walletId}}::bigint,
        NOW(),
        -- amount_asset means "amount in THIS row's asset" (USDC); the BTC
        -- side lives in the channel, not here — NULL avoids displays
        -- printing the BTC figure with a USDC label.
        NULL,
        {{params.estUsdc}}::numeric,
        'pending',
        'chainflip',
        {{params.channelId}},
        {{params.depositAddress}},
        {{params.expiresAt}}::timestamptz,
        'WAITING',
        {{params.srcBtcAmount}}::numeric
      )
      RETURNING id, sales_order_id
    `,
  });
}

export default createSwapPayment;
