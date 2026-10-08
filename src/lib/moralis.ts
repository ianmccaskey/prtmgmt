/**
 * Client-side Moralis integration for on-chain wallet balances (both the
 * EVM deep-index API and the Solana gateway serve
 * `Access-Control-Allow-Origin: *` with the x-api-key header allowed, so
 * the browser can call them directly). Bitcoin isn't covered by Moralis —
 * BTC wallets report supported: false.
 */

const EVM_BASE = 'https://deep-index.moralis.io/api/v2.2';
const SOL_BASE = 'https://solana-gateway.moralis.io';

/** Canonical mainnet token contracts/mints for the stablecoins we accept. */
const TOKENS: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  solana: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
};

export type OnChainBalance = {
  /** Token amount in whole units (e.g. 123.45 USDC). */
  amount: number;
  /** false = chain/asset not queryable via Moralis (BTC). */
  supported: boolean;
};

async function get(apiKey: string, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-API-Key': apiKey, accept: 'application/json' } });
  } catch {
    throw new Error('Could not reach Moralis — check your network connection.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Moralis request failed (HTTP ${res.status}).`);
  }
  return res.json();
}

export type OnChainDeposit = {
  txHash: string;
  amount: number;
  at: string | null;
  from: string | null;
};

// Helius (when a key is configured) is far less rate-limited than the
// public RPC and serves the same JSON-RPC methods.
const solanaRpcUrl = (heliusKey?: string | null) =>
  heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(heliusKey)}` : 'https://api.mainnet-beta.solana.com';

// ---- Pacing + retry ------------------------------------------------
// Helius' free tier allows ~10 requests/second and hard-429s past it —
// and one wallet check can fire dozens of lookups across two tokens
// plus by-hash verifications. Every Solana RPC call in the app funnels
// through ONE queue with minimum spacing, and 429/5xx responses retry
// with exponential backoff (honoring Retry-After when sent).
const RPC_MIN_INTERVAL_MS = 125; // ≈8 req/s ceiling, under the free tier's 10
let rpcQueue: Promise<void> = Promise.resolve();
let rpcLastDone = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = rpcQueue.then(async () => {
    const wait = rpcLastDone + RPC_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      rpcLastDone = Date.now();
    }
  });
  rpcQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function solanaRpcPost(body: unknown, heliusKey?: string | null): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() => fetch(solanaRpcUrl(heliusKey), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new Error(`Solana RPC HTTP ${res.status} (still failing after ${attempt} retries — likely rate limited)`);
      const retryAfterMs = Number(res.headers.get('retry-after')) * 1000;
      const backoffMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? retryAfterMs
        : 400 * Math.pow(2.5, attempt) * (0.8 + Math.random() * 0.4);
      await new Promise(r => setTimeout(r, backoffMs));
      continue;
    }
    if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
    return res;
  }
}

async function solanaRpc(method: string, params: unknown[], heliusKey?: string | null): Promise<unknown> {
  const res = await solanaRpcPost({ jsonrpc: '2.0', id: 1, method, params }, heliusKey);
  const j = await res.json() as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || 'Solana RPC error');
  return j.result;
}

/**
 * JSON-RPC batch: N operations in ONE HTTP request — one rate-limit slot
 * instead of N. Per-item errors come back as null (the deposit scan skips
 * them), positional by request id.
 */
async function solanaRpcBatch(reqs: { method: string; params: unknown[] }[], heliusKey?: string | null): Promise<unknown[]> {
  if (reqs.length === 0) return [];
  const res = await solanaRpcPost(reqs.map((r, i) => ({ jsonrpc: '2.0', id: i, method: r.method, params: r.params })), heliusKey);
  const arr = await res.json() as { id?: number; result?: unknown; error?: unknown }[];
  const out: unknown[] = new Array(reqs.length).fill(null);
  if (!Array.isArray(arr)) throw new Error('Solana RPC batch: unexpected response shape');
  for (const item of arr) {
    if (item && typeof item.id === 'number' && item.id >= 0 && item.id < out.length && !item.error) {
      out[item.id] = item.result ?? null;
    }
  }
  return out;
}

// ---- Immutable-TX cache --------------------------------------------
// A finalized Solana transaction never changes, so its parsed deposit
// delta for a given (signature, owner, mint) caches forever. Persisted
// to localStorage so repeat wallet checks cost ZERO lookups for known
// signatures — with the poisoning-spam dust that dominates the recent
// signature window, this is the difference between ~60 fetches per
// check and a handful. Entries: { d: owner's delta, t: blockTime }.
type SolTxCacheEntry = { d: number; t: number | null };
const SOLTX_CACHE_KEY = 'prt:soltx-cache:v1';
const SOLTX_CACHE_MAX = 1500;
let solTxCache: Map<string, SolTxCacheEntry> | null = null;

function txCache(): Map<string, SolTxCacheEntry> {
  if (solTxCache) return solTxCache;
  solTxCache = new Map();
  try {
    const raw = localStorage.getItem(SOLTX_CACHE_KEY);
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, SolTxCacheEntry][]) solTxCache.set(k, v);
  } catch { /* cold cache is always safe */ }
  return solTxCache;
}

function txCachePut(key: string, entry: SolTxCacheEntry) {
  const c = txCache();
  c.set(key, entry);
  // Trim the LIVE map too, not just the serialization — insertion order
  // ≈ age, drop the oldest once over cap.
  while (c.size > SOLTX_CACHE_MAX) {
    const oldest = c.keys().next().value;
    if (oldest == null) break;
    c.delete(oldest);
  }
  try {
    localStorage.setItem(SOLTX_CACHE_KEY, JSON.stringify([...c.entries()]));
  } catch { /* persistence is best-effort */ }
}

const txCacheKey = (sig: string, owner: string, mint: string) => `${sig}|${owner}|${mint}`;

/**
 * Incoming SPL token deposits to a Solana wallet since a timestamp, via the
 * public Solana RPC (Moralis' gateway has no SPL transfer history). For each
 * recent signature on the wallet's token account, the owner's pre/post token
 * balance delta IS the deposited amount — so a transfer whose amount differs
 * from the recorded payment is caught, not just missing ones.
 */
async function getSolanaTokenDeposits(
  mint: string, owner: string, sinceIso: string | null, heliusKey?: string | null,
): Promise<OnChainDeposit[]> {
  const sinceEpoch = sinceIso ? Date.parse(sinceIso) / 1000 : 0;
  const accs = await solanaRpc('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }], heliusKey) as
    { value?: { pubkey: string }[] };
  const deposits: OnChainDeposit[] = [];
  for (const acc of accs.value || []) {
    const sigs = await solanaRpc('getSignaturesForAddress', [acc.pubkey, { limit: 50 }], heliusKey) as
      { signature: string; blockTime?: number | null; err?: unknown }[];
    const due = (sigs || []).filter(s => !s.err && (s.blockTime ?? 0) >= sinceEpoch).slice(0, 30);

    // Known signatures resolve from the immutable-TX cache; only the rest
    // are fetched, batched 15 per HTTP request.
    const uncached = due.filter(s => !txCache().has(txCacheKey(s.signature, owner, mint)));
    for (let i = 0; i < uncached.length; i += 15) {
      const chunk = uncached.slice(i, i + 15);
      const results = await solanaRpcBatch(
        chunk.map(s => ({ method: 'getTransaction', params: [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] })),
        heliusKey,
      );
      results.forEach((raw, j) => {
        const tx = raw as SolanaParsedTx;
        // null = not found or per-item error — may be transient, never cached.
        if (!tx) return;
        txCachePut(txCacheKey(chunk[j].signature, owner, mint), {
          d: tx.meta?.err ? 0 : splOwnerDelta(tx, owner, mint),
          t: tx.blockTime ?? null,
        });
      });
    }

    for (const s of due) {
      const hit = txCache().get(txCacheKey(s.signature, owner, mint));
      if (!hit || hit.d <= 0) continue;
      deposits.push({
        txHash: s.signature,
        amount: hit.d,
        at: hit.t ? new Date(hit.t * 1000).toISOString() : null,
        from: null,
      });
    }
  }
  return deposits;
}

type SolanaParsedTx = {
  blockTime?: number | null;
  meta?: {
    err: unknown;
    preTokenBalances?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[];
    postTokenBalances?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[];
  };
} | null;

/** The owner's net gain of `mint` in one parsed Solana TX (pre/post delta). */
function splOwnerDelta(tx: SolanaParsedTx, owner: string, mint: string): number {
  const bal = (rows?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[]) =>
    (rows || []).filter(b => b.owner === owner && b.mint === mint)
      .reduce((sum, b) => sum + (b.uiTokenAmount.uiAmount ?? 0), 0);
  return bal(tx?.meta?.postTokenBalances) - bal(tx?.meta?.preTokenBalances);
}

/**
 * Targeted verification of ONE transaction: does this TX exist on-chain and
 * move `asset` into `address`? Used when a recorded hash isn't in the
 * cycle-windowed deposit list — a payment recorded late can point at a
 * perfectly valid deposit from before the cycle started, and only a direct
 * by-hash lookup can tell that apart from a phantom TX. Returns the deposit
 * (amount, timestamp) or null when the TX is unknown, reverted, or moves no
 * such funds to the wallet. Throws on transport errors so callers can retry.
 */
export async function getTxDeposit(
  apiKey: string, asset: string, network: string, address: string, txHash: string,
  heliusKey?: string | null,
): Promise<OnChainDeposit | null> {
  if (network === 'solana') {
    const mint = TOKENS.solana[asset];
    if (!mint) return null;
    // Finalized TXs are immutable — a cached parse answers instantly.
    const cached = txCache().get(txCacheKey(txHash, address, mint));
    if (cached) {
      return cached.d > 0
        ? { txHash, amount: cached.d, at: cached.t ? new Date(cached.t * 1000).toISOString() : null, from: null }
        : null;
    }
    let tx: SolanaParsedTx;
    try {
      tx = await solanaRpc('getTransaction',
        [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], heliusKey) as SolanaParsedTx;
    } catch (e: unknown) {
      // A malformed signature (e.g. an EVM hash recorded on a Solana
      // payment) is a deterministic "no such TX", not a transient failure
      // to retry — the RPC rejects it as an invalid param.
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('invalid')) return null;
      throw e;
    }
    if (!tx) return null; // unknown hash — possibly unindexed yet, never cached
    const delta = tx.meta?.err ? 0 : splOwnerDelta(tx, address, mint);
    txCachePut(txCacheKey(txHash, address, mint), { d: delta, t: tx.blockTime ?? null });
    if (delta <= 0) return null;
    return { txHash, amount: delta, at: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null, from: null };
  }
  if (network !== 'ethereum') return null;
  const token = TOKENS.ethereum[asset];
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(`${EVM_BASE}/transaction/${txHash}/verbose?chain=eth`,
      { headers: { 'X-API-Key': apiKey, accept: 'application/json' } });
  } catch {
    throw new Error('Could not reach Moralis — check your network connection.');
  }
  // Unknown hash: the TX simply doesn't exist on this chain.
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Moralis request failed (HTTP ${res.status}).`);
  const tx = await res.json() as {
    block_timestamp?: string; receipt_status?: string | number;
    logs?: { address?: string; decoded_event?: { label?: string; params?: { name?: string; value?: string }[] } }[];
  };
  if (tx.receipt_status != null && String(tx.receipt_status) !== '1') return null; // reverted
  let amount = 0;
  let from: string | null = null;
  for (const l of tx.logs || []) {
    if (String(l.address || '').toLowerCase() !== token.toLowerCase()) continue;
    const d = l.decoded_event;
    if (!d || d.label !== 'Transfer') continue;
    const param = (n: string) => (d.params || []).find(p => p.name === n)?.value;
    if (String(param('to') || '').toLowerCase() !== address.toLowerCase()) continue;
    // Moralis decodes the ERC-20 amount as 'amount' (USDT) or 'value'
    // (standard ABI); both stablecoins are 6-decimal on Ethereum.
    amount += Number(param('amount') ?? param('value') ?? 0) / 1e6;
    from = String(param('from') ?? '') || from;
  }
  if (amount <= 0) return null;
  return { txHash, amount, at: tx.block_timestamp || null, from };
}

/**
 * Incoming token deposits to a wallet since a timestamp. EVM via Moralis;
 * Solana via the public Solana RPC (no API key needed — Moralis' gateway
 * has no SPL transfer history). Returns null when the chain/asset isn't
 * queryable (BTC).
 */
export async function getTokenDeposits(
  apiKey: string, asset: string, network: string, address: string, sinceIso: string | null,
  heliusKey?: string | null,
): Promise<OnChainDeposit[] | null> {
  if (network === 'solana') {
    const mint = TOKENS.solana[asset];
    if (!mint) return null;
    return getSolanaTokenDeposits(mint, address, sinceIso, heliusKey);
  }
  if (network !== 'ethereum') return null;
  const token = TOKENS.ethereum[asset];
  if (!token) return null;
  const from = sinceIso ? `&from_date=${encodeURIComponent(sinceIso)}` : '';
  type TransferRow = {
    transaction_hash?: string; value?: string; token_decimals?: string | number;
    block_timestamp?: string; to_address?: string; from_address?: string; address?: string;
  };
  const rows: TransferRow[] = [];
  // The wallet token-transfers endpoint filters by contract_addresses and
  // paginates by cursor; follow it (capped) so busy cycles aren't truncated.
  let cursor = '';
  for (let page = 0; page < 10; page++) {
    const cur = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const d = await get(apiKey, `${EVM_BASE}/${address}/erc20/transfers?chain=eth&contract_addresses%5B0%5D=${token}${from}&limit=100${cur}`) as {
      result?: TransferRow[]; cursor?: string | null;
    };
    rows.push(...(Array.isArray(d?.result) ? d.result : []));
    if (!d?.cursor) break;
    cursor = d.cursor;
  }
  return rows
    // Incoming only, and re-check the token contract client-side in case the
    // server-side filter is ignored — an unrelated token must never be
    // mistaken for a stablecoin deposit.
    .filter(t => String(t.to_address || '').toLowerCase() === address.toLowerCase())
    .filter(t => String(t.address || '').toLowerCase() === token.toLowerCase())
    .map(t => ({
      txHash: String(t.transaction_hash || ''),
      amount: Number(t.value || 0) / Math.pow(10, Number(t.token_decimals ?? 6)),
      at: t.block_timestamp || null,
      from: t.from_address || null,
    }));
}

export async function getOnChainBalance(
  apiKey: string, asset: string, network: string, address: string,
): Promise<OnChainBalance> {
  if (network === 'ethereum') {
    if (asset === 'ETH') {
      const d = await get(apiKey, `${EVM_BASE}/${address}/balance?chain=eth`) as { balance?: string };
      return { amount: Number(d.balance || 0) / 1e18, supported: true };
    }
    const token = TOKENS.ethereum[asset];
    if (!token) return { amount: 0, supported: false };
    const d = await get(apiKey, `${EVM_BASE}/${address}/erc20?chain=eth&token_addresses%5B0%5D=${token}`) as
      Array<{ balance?: string; decimals?: number }>;
    const row = Array.isArray(d) ? d[0] : undefined;
    if (!row) return { amount: 0, supported: true };
    return { amount: Number(row.balance || 0) / Math.pow(10, Number(row.decimals ?? 6)), supported: true };
  }
  if (network === 'solana') {
    if (asset === 'SOL') {
      const d = await get(apiKey, `${SOL_BASE}/account/mainnet/${address}/balance`) as { solana?: string };
      return { amount: Number(d.solana || 0), supported: true };
    }
    const mint = TOKENS.solana[asset];
    if (!mint) return { amount: 0, supported: false };
    const d = await get(apiKey, `${SOL_BASE}/account/mainnet/${address}/tokens`) as
      Array<{ mint?: string; amount?: string }>;
    const row = Array.isArray(d) ? d.find(t => t.mint === mint) : undefined;
    return { amount: Number(row?.amount || 0), supported: true };
  }
  // bitcoin and anything else Moralis can't serve
  return { amount: 0, supported: false };
}
