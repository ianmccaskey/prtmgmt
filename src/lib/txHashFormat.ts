/**
 * Which network a TX hash/signature's FORMAT implies. Only formats that
 * are PROOF of a network return a value — the mismatch against a
 * payment's recorded network is then a fact (ORD-2026-0347: a Solana
 * signature tied to a USDT/ethereum payment), not a judgment call:
 *  - ethereum: 0x + 64 hex — the 0x prefix is Ethereum's convention.
 *  - solana:   base58 signature of a 64-byte sig, 80-90 chars (~87-88
 *    typical; rare short sigs from leading zero bytes fall below 80 and
 *    return null — a detection gap, never a wrong answer).
 * Bare 64-hex is deliberately NOT classified: a Bitcoin TXID and a
 * prefixless Ethereum hash look identical, so claiming either would be a
 * guess. null = no opinion (partial paste, swap ids, bare hex) — callers
 * must treat it as such, never as confirmation.
 */
export function txHashNetwork(raw: string): 'ethereum' | 'solana' | null {
  const h = (raw || '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(h)) return 'ethereum';
  if (/^[0-9a-fA-F]{64}$/.test(h)) return null; // BTC txid or prefixless ETH hash — ambiguous
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(h)) return 'solana';
  return null;
}

/** Human description of a hash format, for mismatch messages. */
export function txHashKindLabel(net: 'ethereum' | 'solana'): string {
  return net === 'solana' ? 'a Solana signature' : 'an Ethereum TX hash';
}
