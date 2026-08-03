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

async function solanaRpc(method: string, params: unknown[], heliusKey?: string | null): Promise<unknown> {
  const res = await fetch(solanaRpcUrl(heliusKey), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const j = await res.json() as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || 'Solana RPC error');
  return j.result;
}

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
    for (const s of due) {
      const tx = await solanaRpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], heliusKey) as {
        blockTime?: number | null;
        meta?: {
          err: unknown;
          preTokenBalances?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[];
          postTokenBalances?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[];
        };
      } | null;
      if (!tx || tx.meta?.err) continue;
      const bal = (rows?: { owner?: string; mint?: string; uiTokenAmount: { uiAmount: number | null } }[]) =>
        (rows || []).filter(b => b.owner === owner && b.mint === mint)
          .reduce((sum, b) => sum + (b.uiTokenAmount.uiAmount ?? 0), 0);
      const delta = bal(tx.meta?.postTokenBalances) - bal(tx.meta?.preTokenBalances);
      if (delta > 0) {
        deposits.push({
          txHash: s.signature,
          amount: delta,
          at: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
          from: null,
        });
      }
    }
  }
  return deposits;
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
