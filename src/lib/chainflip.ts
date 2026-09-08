/**
 * Chainflip deposit-channel integration: the customer sends plain BTC — no
 * memo, from any wallet or exchange — to a unique per-payment deposit
 * address, and the protocol swaps and delivers USDC to our Ethereum
 * receive wallet automatically. The SDK talks to Chainflip's hosted
 * swapping service and default broker, so there is no broker
 * infrastructure on our side.
 *
 * Units: the SDK takes BTC amounts in sats (1e8) and reports USDC in
 * base units (1e6). Channels expire (~24h) — the customer must send
 * before the expiry shown on the payment.
 */
import { SwapSDK } from '@chainflip/sdk/swap';

const sdk = new SwapSDK({ network: 'mainnet' });

/** Mainnet swapping-service REST base (same service the SDK calls). */
export const CHAINFLIP_SWAP_API = 'https://chainflip-swap.chainflip.io';

export type BtcSwapQuote = {
  /** Opaque SDK quote — pass back to openBtcDepositChannel unchanged. */
  quote: unknown;
  btcAmount: number;
  estUsdc: number;
  slippagePercent: number;
  estMinutes: number;
};

/**
 * Inverse quote: how much BTC must the customer send so the swap DELIVERS
 * at least `targetUsd` USDC after fees? Chainflip quotes are exact-input,
 * so this probes with a reference quote to learn the effective rate, then
 * requotes at the implied BTC amount and nudges up until the estimate
 * covers the target (fees have fixed components, so one or two rounds
 * converge).
 */
export async function getBtcQuoteForUsd(targetUsd: number): Promise<BtcSwapQuote> {
  if (!(targetUsd > 0)) throw new Error('Enter a valid USD amount.');
  const probe = await getBtcToUsdcQuote(0.01);
  let btc = (targetUsd / probe.estUsdc) * 0.01;
  let q = await getBtcToUsdcQuote(round8(btc));
  for (let i = 0; i < 3 && q.estUsdc < targetUsd; i++) {
    btc = btc * (targetUsd / q.estUsdc) * 1.002;
    q = await getBtcToUsdcQuote(round8(btc));
  }
  return q;
}

const round8 = (n: number) => Math.ceil(n * 1e8) / 1e8;

export async function getBtcToUsdcQuote(btcAmount: number): Promise<BtcSwapQuote> {
  const sats = Math.round(btcAmount * 1e8);
  if (!(sats > 0)) throw new Error('Enter a valid BTC amount.');
  const { quotes } = await sdk.getQuoteV2({
    srcChain: 'Bitcoin', srcAsset: 'BTC',
    destChain: 'Ethereum', destAsset: 'USDC',
    amount: String(sats),
  });
  const q = quotes.find(x => x.type === 'REGULAR');
  if (!q) throw new Error('Chainflip returned no route for this amount (below the minimum?).');
  return {
    quote: q,
    btcAmount,
    estUsdc: Number(q.egressAmount) / 1e6,
    slippagePercent: q.recommendedSlippageTolerancePercent,
    estMinutes: Math.ceil(((q as { estimatedDurationSeconds?: number }).estimatedDurationSeconds ?? 900) / 60),
  };
}

export type BtcDepositChannel = {
  channelId: string;
  depositAddress: string;
  expiresAt: string | null;
};

/**
 * Opens the deposit channel. refundBtcAddress is REQUIRED by the protocol:
 * if the swap can't execute within tolerance, the BTC is returned there —
 * it must be an address the CUSTOMER controls.
 */
export async function openBtcDepositChannel(
  q: BtcSwapQuote, destAddress: string, refundBtcAddress: string,
): Promise<BtcDepositChannel> {
  const ch = await sdk.requestDepositAddressV2({
    // The SDK validates the quote object it produced; the cast just erases
    // our opaque wrapper.
    quote: q.quote as Parameters<SwapSDK['requestDepositAddressV2']>[0]['quote'],
    destAddress,
    fillOrKillParams: {
      slippageTolerancePercent: q.slippagePercent,
      refundAddress: refundBtcAddress.trim(),
      retryDurationBlocks: 100,
    },
  });
  const expMs = (ch as { estimatedDepositChannelExpiryTime?: number }).estimatedDepositChannelExpiryTime;
  return {
    channelId: String(ch.depositChannelId),
    depositAddress: String(ch.depositAddress),
    expiresAt: expMs ? new Date(expMs).toISOString() : null,
  };
}

export type BtcSwapStatus = {
  state: string;
  depositTx: string | null;
  egressTx: string | null;
  egressUsdc: number | null;
};

/** Status via REST (also used server-side by tools/sync-swaps.ts). */
export async function getBtcSwapStatus(channelId: string): Promise<BtcSwapStatus> {
  const res = await fetch(`${CHAINFLIP_SWAP_API}/v2/swaps/${encodeURIComponent(channelId)}`);
  if (res.status === 404) return { state: 'WAITING', depositTx: null, egressTx: null, egressUsdc: null };
  if (!res.ok) throw new Error(`Chainflip status failed (HTTP ${res.status})`);
  const s = await res.json() as {
    state?: string;
    deposit?: { txRef?: string };
    swapEgress?: { txRef?: string; amount?: string };
  };
  // txRef arrives with a prefix (docs show forms like "tx:…"); strip
  // through the last colon and prefer a canonical 0x hash — the stored
  // value must equal the on-chain deposit hash for the wallet audit to
  // match. Falls back to the raw value when it doesn't validate.
  const cleanTx = (t?: string | null) => {
    if (!t) return null;
    const stripped = t.slice(t.lastIndexOf(':') + 1);
    return /^0x[0-9a-fA-F]{64}$/.test(stripped) ? stripped : t;
  };
  return {
    state: String(s.state ?? 'WAITING'),
    depositTx: cleanTx(s.deposit?.txRef),
    egressTx: cleanTx(s.swapEgress?.txRef),
    egressUsdc: s.swapEgress?.amount != null ? Number(s.swapEgress.amount) / 1e6 : null,
  };
}
