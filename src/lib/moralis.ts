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
