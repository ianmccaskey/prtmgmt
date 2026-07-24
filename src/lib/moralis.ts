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

/**
 * Incoming token deposits to a wallet since a timestamp. EVM only — the
 * Solana gateway doesn't expose SPL transfer history here; callers should
 * fall back to manual comparison for Solana wallets. Returns null when the
 * chain/asset isn't queryable.
 */
export async function getTokenDeposits(
  apiKey: string, asset: string, network: string, address: string, sinceIso: string | null,
): Promise<OnChainDeposit[] | null> {
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
    .filter(t => !t.address || String(t.address).toLowerCase() === token.toLowerCase())
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
