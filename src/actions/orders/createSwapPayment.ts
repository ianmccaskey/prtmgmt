import { action } from '@uibakery/data';

/**
 * Records a 1Click auto-swap payment: the customer sends BTC or USDT on Tron
 * to a one-time deposit address and USDC arrives at our Ethereum wallet.
 * Created PENDING with the estimated USDC amount; the swap sync (or the
 * drawer's Check Swap button) completes it with the real delivery TX and
 * amount. swap_channel_id holds the deposit address, which is how 1Click
 * identifies the swap. Callers chain recomputePaymentStatus after.
 *
 * Inserts nothing (empty RETURNING) unless the wallet row still is the
 * active USDC/Ethereum wallet at the address the swap delivers to: a wallet
 * edited in Settings after the quote would otherwise leave this record
 * pointing at a different address from the money.
 */
export function createSwapPayment() {
  return action('createSwapPayment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO order_payments (
        sales_order_id, direction, asset, network, receive_wallet_id,
        quoted_at, amount_asset, amount_usd, verification_status,
        swap_provider, swap_channel_id, swap_deposit_address, swap_expires_at, swap_state,
        swap_src_asset, swap_src_amount, swap_min_src_amount, swap_refund_address,
        swap_correlation_id, swap_signature
      )
      SELECT
        {{params.orderId}}::bigint,
        'incoming',
        'USDC',
        'ethereum',
        rw.id,
        NOW(),
        -- amount_asset means "amount in THIS row's asset" (USDC); the source
        -- side lives in the swap_src columns, not here. NULL avoids displays
        -- printing the BTC figure with a USDC label.
        NULL,
        {{params.estUsdc}}::numeric,
        'pending',
        'oneclick',
        {{params.depositAddress}},
        {{params.depositAddress}},
        {{params.expiresAt}}::timestamptz,
        'PENDING_DEPOSIT',
        {{params.srcAsset}},
        {{params.srcAmount}}::numeric,
        {{params.minSrcAmount}}::numeric,
        {{params.refundAddress}},
        NULLIF({{params.correlationId}}, ''),
        NULLIF({{params.signature}}, '')
      FROM receive_wallets rw
      WHERE rw.id = {{params.walletId}}::bigint
        AND rw.address = {{params.destAddress}}
        AND rw.asset = 'USDC' AND rw.network = 'ethereum' AND rw.is_active
      RETURNING id, sales_order_id
    `,
  });
}

export default createSwapPayment;
