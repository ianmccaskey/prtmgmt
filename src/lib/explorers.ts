/**
 * Block-explorer links for transaction hashes, so every TX ID in the app
 * can be a one-click lookup. Payment rows know their network; payout rows
 * (commission_payments) don't, so their chain is inferred from hash shape.
 */

/** Explorer URL for a TX on a known network; falls back to inference. */
export function txExplorerUrl(network: string | null | undefined, hash: string | null | undefined): string | null {
  const h = (hash || '').trim();
  if (!h) return null;
  const n = String(network || '').toLowerCase();
  if (n === 'ethereum') return `https://etherscan.io/tx/${h}`;
  if (n === 'solana') return `https://solscan.io/tx/${h}`;
  if (n === 'bitcoin') return `https://mempool.space/tx/${h}`;
  return txExplorerUrlAuto(h);
}

/**
 * Chain inferred from the hash's shape:
 * - 0x + 64 hex → EVM (Etherscan)
 * - long base58 (Solana signatures run ~87–88 chars) → Solscan
 * - bare 64 hex → Bitcoin txid (mempool.space)
 */
export function txExplorerUrlAuto(hash: string | null | undefined): string | null {
  const h = (hash || '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(h)) return `https://etherscan.io/tx/${h}`;
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(h)) return `https://solscan.io/tx/${h}`;
  if (/^[0-9a-fA-F]{64}$/.test(h)) return `https://mempool.space/tx/${h}`;
  return null;
}
