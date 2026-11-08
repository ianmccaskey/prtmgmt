/**
 * NEAR Intents 1Click swaps: the customer sends plain BTC, or USDT on Tron,
 * to a one-time deposit address, and USDC arrives at our Ethereum receive
 * wallet. Called straight from the browser (1Click allows CORS) and imported
 * by tools/sync-swaps.ts, so this file must stay dependency-free.
 *
 * Quoting uses two swap types on purpose:
 *  - EXACT_OUTPUT (dry) answers "what must the customer send so we receive
 *    the amount owed?", with the slippage buffer included.
 *  - FLEX_INPUT is what actually runs, at that figure. It swaps the whole
 *    deposit, so an over-send lands as USDC we record, instead of a small
 *    refund to a wallet the ledger can't see.
 *
 * No API key: keyless costs slightly more, and app_settings can be read by
 * every logged-in user, so it isn't a safe home for one.
 */

export const ONECLICK_API = 'https://1click.chaindefuser.com/v0';

/** USDC on Ethereum. Every swap lands here. */
const DEST_ASSET = 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';
const USDC_DECIMALS = 6;

/** What the customer is told. */
export const SEND_WINDOW_HOURS = 24;
/**
 * The deadline we request: swaps stop and refunds begin after it.
 * Deliberately longer than the window above, because a stale price fails
 * safely as a refund. 1Click then keeps the address open a further 72 hours
 * (measured 2026-11-08: request 30h, address closes at 102h) and returns that
 * later time as the quote's deadline. Past it, the docs say a deposit "may be
 * lost".
 */
const ADDRESS_LIFETIME_HOURS = 72;

export type SwapRoute = 'BTC' | 'USDT_TRON';

type RouteConfig = {
  tabLabel: string;
  asset: string;
  networkLabel: string;
  assetId: string;
  decimals: number;
  /** The ask rounds UP to this many decimals, so it's easy to copy. */
  askDecimals: number;
  /** Covers price movement between the quote and the swap. */
  slippageBps: number;
  refundSettingKey: string;
  refundPlaceholder: string;
};

export const SWAP_ROUTES: Record<SwapRoute, RouteConfig> = {
  BTC: {
    tabLabel: 'BTC', asset: 'BTC', networkLabel: 'Bitcoin',
    assetId: 'nep141:btc.omft.near',
    decimals: 8, askDecimals: 5, slippageBps: 100,
    refundSettingKey: 'swap_btc_refund_address', refundPlaceholder: 'bc1q…',
  },
  USDT_TRON: {
    tabLabel: 'USDT (Tron)', asset: 'USDT', networkLabel: 'Tron (TRC-20)',
    assetId: 'nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near',
    decimals: 6, askDecimals: 2, slippageBps: 30,
    refundSettingKey: 'swap_tron_refund_address', refundPlaceholder: 'T…',
  },
};

export function isSwapRoute(v: unknown): v is SwapRoute {
  return v === 'BTC' || v === 'USDT_TRON';
}

/** Rep-facing wording for swap_state values. */
export const SWAP_STATE_LABELS: Record<string, string> = {
  PENDING_DEPOSIT: 'Waiting for deposit',
  KNOWN_DEPOSIT_TX: 'Deposit seen',
  PROCESSING: 'Swapping',
  INCOMPLETE_DEPOSIT: 'Deposit too small',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

// ── Amounts ────────────────────────────────────────────────────────────

const usdToUnits = (usd: number) => BigInt(Math.round(usd * 10 ** USDC_DECIMALS));

function formatUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function roundUpAsk(units: bigint, r: RouteConfig): bigint {
  const step = 10n ** BigInt(r.decimals - r.askDecimals);
  return ((units + step - 1n) / step) * step;
}

const unitsToUsd = (units: bigint) => Number(units) / 10 ** USDC_DECIMALS;

// ── Address validation ─────────────────────────────────────────────────
// A typo in a refund address loses real money, and 1Click answers a bad one
// with a bare "Internal server error", so checksums are verified here.

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const i = BASE58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = n === 0n ? [] : (hex.match(/../g) ?? []).map(b => parseInt(b, 16));
  const zeros = /^1*/.exec(s)?.[0].length ?? 0;
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...body]);
}

async function base58CheckVersion(s: string): Promise<number | null> {
  const b = base58Decode(s);
  if (!b || b.length !== 25) return null;
  const sha = async (d: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', d));
  const sum = await sha(await sha(b.subarray(0, 21)));
  for (let i = 0; i < 4; i++) if (sum[i] !== b[21 + i]) return null;
  return b[0];
}

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

/** bc1 segwit address: bech32 for witness v0, bech32m for v1 and up. */
function isBech32Btc(addr: string): boolean {
  if (!/^bc1[a-z0-9]{8,87}$/.test(addr)) return false;
  const data = [...addr.slice(3)].map(c => BECH32.indexOf(c));
  if (data.includes(-1)) return false;
  const hrp = [3, 3, 0, 2, 3]; // "bc", expanded per BIP-173
  const expected = data[0] === 0 ? 1 : 0x2bc830a3;
  return bech32Polymod([...hrp, ...data]) === expected;
}

async function isValidAddress(route: SwapRoute, address: string): Promise<boolean> {
  if (route === 'USDT_TRON') return (await base58CheckVersion(address)) === 0x41;
  if (address.startsWith('bc1')) return isBech32Btc(address);
  const v = await base58CheckVersion(address);
  return v === 0x00 || v === 0x05;
}

/** Returns what's wrong with the refund address, or null if it's usable. */
export async function refundAddressError(route: SwapRoute, address: string): Promise<string | null> {
  const r = SWAP_ROUTES[route];
  if (!address.trim()) return `Enter a ${r.networkLabel} refund address. 1Click requires one, and failed swaps return there.`;
  if (await isValidAddress(route, address.trim())) return null;
  return `That isn't a valid ${r.networkLabel} address. Check it for typos: a refund sent to a bad address is lost.`;
}

// ── API ────────────────────────────────────────────────────────────────

type QuoteResponse = {
  correlationId?: string;
  signature?: string;
  quoteRequest?: Record<string, unknown>;
  quote: {
    amountIn: string;
    minAmountIn: string;
    amountOut: string;
    minAmountOut: string;
    timeEstimate?: number;
    depositAddress?: string;
    depositMemo?: string | null;
    deadline?: string;
  };
};

const UNAVAILABLE = '1Click isn\'t responding right now. Try again in a few minutes. If the customer can\'t wait, take USDC or USDT directly.';

async function postQuote(body: Record<string, unknown>): Promise<QuoteResponse> {
  let res: Response;
  try {
    res = await fetch(`${ONECLICK_API}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(UNAVAILABLE);
  }
  const j = await res.json().catch(() => null) as (QuoteResponse & { message?: string }) | null;
  if (res.ok && j?.quote) return j;
  if (res.status >= 500) throw new Error(UNAVAILABLE);
  const msg = String(j?.message ?? '');
  // Seen when refundTo was a token contract rather than a wallet.
  if (/internal server error/i.test(msg)) {
    throw new Error('1Click rejected this quote. The usual cause is the refund address: it must be an ordinary wallet, not a token contract. Check it and try again.');
  }
  throw new Error(msg ? `1Click: ${msg}` : `1Click refused this quote (HTTP ${res.status}).`);
}

type QuoteTarget = { route: SwapRoute; owedUsd: number; destAddress: string; refundAddress: string };

function quoteBody(t: QuoteTarget, swapType: string, amount: bigint, dry: boolean, deadline: string) {
  const r = SWAP_ROUTES[t.route];
  return {
    dry,
    swapType,
    slippageTolerance: r.slippageBps,
    originAsset: r.assetId,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: DEST_ASSET,
    amount: amount.toString(),
    refundTo: t.refundAddress,
    refundType: 'ORIGIN_CHAIN',
    recipient: t.destAddress,
    recipientType: 'DESTINATION_CHAIN',
    deadline,
  };
}

const addressDeadline = () => new Date(Date.now() + ADDRESS_LIFETIME_HOURS * 3_600_000).toISOString();

/**
 * FLEX_INPUT quote at `ask`, raised once if its guaranteed minimum doesn't
 * cover the amount owed (rounding, or the market moved since the last call).
 */
async function flexCoveringOwed(t: QuoteTarget, ask: bigint, dry: boolean, deadline: string) {
  const owed = usdToUnits(t.owedUsd);
  let res = await postQuote(quoteBody(t, 'FLEX_INPUT', ask, dry, deadline));
  let minOut = BigInt(res.quote.minAmountOut);
  if (minOut < owed) {
    ask = roundUpAsk((ask * owed) / minOut + 1n, SWAP_ROUTES[t.route]);
    res = await postQuote(quoteBody(t, 'FLEX_INPUT', ask, dry, deadline));
    minOut = BigInt(res.quote.minAmountOut);
  }
  if (minOut < owed) throw new Error('The price is moving too fast to guarantee the amount owed. Get a new quote.');
  return { ask, res };
}

export type OneClickQuote = QuoteTarget & {
  /** What the customer sends, in the source asset's base units. */
  askUnits: string;
  /** The same figure, human-readable. */
  srcAmount: string;
  /** Below this the deposit is not swapped. */
  minSrcAmount: string;
  estUsdc: number;
  minUsdc: number;
  /** After the deposit confirms. */
  estMinutes: number;
};

function toQuote(t: QuoteTarget, ask: bigint, q: QuoteResponse['quote']): OneClickQuote {
  const { decimals } = SWAP_ROUTES[t.route];
  return {
    ...t,
    askUnits: ask.toString(),
    srcAmount: formatUnits(ask, decimals),
    minSrcAmount: formatUnits(BigInt(q.minAmountIn), decimals),
    estUsdc: unitsToUsd(BigInt(q.amountOut)),
    minUsdc: unitsToUsd(BigInt(q.minAmountOut)),
    estMinutes: Math.max(1, Math.ceil((q.timeEstimate ?? 900) / 60)),
  };
}

/** Preview only: dry calls create nothing. */
export async function getOneClickQuote(t: QuoteTarget): Promise<OneClickQuote> {
  if (!(t.owedUsd > 0)) throw new Error('Enter the USD amount the customer owes.');
  const addrErr = await refundAddressError(t.route, t.refundAddress);
  if (addrErr) throw new Error(addrErr);
  const deadline = addressDeadline();
  const exact = await postQuote(quoteBody(t, 'EXACT_OUTPUT', usdToUnits(t.owedUsd), true, deadline));
  const firstAsk = roundUpAsk(BigInt(exact.quote.amountIn), SWAP_ROUTES[t.route]);
  const { ask, res } = await flexCoveringOwed(t, firstAsk, true, deadline);
  return toQuote(t, ask, res.quote);
}

export type OneClickDeposit = OneClickQuote & {
  depositAddress: string;
  expiresAt: string;
  correlationId: string;
  signature: string;
};

/**
 * Creates the real deposit address. Refuses unless 1Click echoes what we
 * asked for: the customer gets one shot at this address, so a surprise here
 * must stop before it reaches them.
 */
export async function openOneClickDeposit(q: OneClickQuote): Promise<OneClickDeposit> {
  const r = SWAP_ROUTES[q.route];
  const deadline = addressDeadline();
  const { ask, res } = await flexCoveringOwed(q, BigInt(q.askUnits), false, deadline);
  const echo = res.quoteRequest ?? {};
  const matches = echo.recipient === q.destAddress && echo.refundTo === q.refundAddress
    && echo.originAsset === r.assetId && echo.destinationAsset === DEST_ASSET
    && echo.swapType === 'FLEX_INPUT' && String(echo.amount) === ask.toString();
  if (!matches) throw new Error('1Click\'s response didn\'t match this quote, so no address was saved. Get a new quote.');

  const { depositAddress, depositMemo } = res.quote;
  if (!depositAddress || !(await isValidAddress(q.route, depositAddress))) {
    throw new Error(`1Click didn't return a valid ${r.networkLabel} deposit address. Get a new quote.`);
  }
  if (depositMemo) throw new Error('1Click wants a memo on this deposit, which this flow doesn\'t support. Take USDC or USDT directly.');

  const expiresMs = Date.parse(res.quote.deadline ?? '');
  if (!(expiresMs > Date.now() + SEND_WINDOW_HOURS * 3_600_000)) {
    throw new Error(`1Click would close this address within ${SEND_WINDOW_HOURS} hours, which is shorter than the time customers are given. Get a new quote.`);
  }

  return {
    ...toQuote(q, ask, res.quote),
    depositAddress,
    expiresAt: new Date(expiresMs).toISOString(),
    correlationId: String(res.correlationId ?? ''),
    signature: String(res.signature ?? ''),
  };
}

export type OneClickStatus = {
  /** 1Click's status, or NOT_FOUND when it doesn't know the address. */
  state: string;
  depositSeen: boolean;
  /** Set only when there is exactly one well-formed Ethereum hash. */
  egressTx: string | null;
  egressUsdc: number | null;
  refundedAmount: string | null;
  refundReason: string | null;
};

const ETH_HASH = /^0x[0-9a-fA-F]{64}$/;

/** apiBase exists so tools/sync-swaps.ts can be tested against a mock. */
export async function getOneClickStatus(depositAddress: string, apiBase = ONECLICK_API): Promise<OneClickStatus> {
  const res = await fetch(`${apiBase}/status?depositAddress=${encodeURIComponent(depositAddress)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) {
    return { state: 'NOT_FOUND', depositSeen: false, egressTx: null, egressUsdc: null, refundedAmount: null, refundReason: null };
  }
  if (!res.ok) throw new Error(`1Click status failed (HTTP ${res.status})`);
  const s = await res.json() as {
    status?: string;
    swapDetails?: {
      originChainTxHashes?: { hash?: string }[];
      destinationChainTxHashes?: { hash?: string }[];
      amountOut?: string | null;
      refundedAmountFormatted?: string | null;
      refundReason?: string | null;
    };
  };
  const d = s.swapDetails ?? {};
  const hashes = d.destinationChainTxHashes ?? [];
  const only = hashes.length === 1 ? String(hashes[0].hash ?? '') : '';
  return {
    state: String(s.status ?? 'PENDING_DEPOSIT'),
    depositSeen: (d.originChainTxHashes ?? []).length > 0,
    // tx_hash must equal the on-chain USDC deposit for the wallet audit to
    // match, so anything ambiguous goes to a person instead.
    egressTx: ETH_HASH.test(only) ? only : null,
    egressUsdc: d.amountOut ? unitsToUsd(BigInt(d.amountOut)) : null,
    refundedAmount: d.refundedAmountFormatted ?? null,
    refundReason: d.refundReason ?? null,
  };
}

/** One line for the rep, for any status that didn't just settle the row. */
export function describeSwapStatus(st: OneClickStatus): string {
  if (st.state === 'NOT_FOUND') return '1Click doesn\'t know this address yet. Try again in a minute.';
  if (st.state === 'SUCCESS') return 'The swap finished, but its delivery record needs checking by hand. Search the deposit address on the NEAR Intents Explorer.';
  if (st.state === 'REFUNDED') {
    const amount = st.refundedAmount ? ` ${st.refundedAmount}` : '';
    const reason = st.refundReason ? ` (${st.refundReason})` : '';
    return `Refunded${amount} to the refund address${reason}.`;
  }
  return `Swap state: ${SWAP_STATE_LABELS[st.state] ?? st.state}${st.depositSeen ? ', deposit seen' : ''}.`;
}

/** The message a rep pastes to the customer. */
export function customerSwapText(route: SwapRoute, amount: string, address: string, sendBy: Date): string {
  const r = SWAP_ROUTES[route];
  const when = sendBy.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return [
    `Please send ${amount} ${r.asset} on the ${r.networkLabel} network to this one-time address:`,
    address,
    `Send it by ${when}, as one transfer of at least this amount, and only on ${r.networkLabel}. Funds sent late or on another network may not be recoverable. Please send from your own wallet.`,
  ].join('\n\n');
}
