/**
 * Crypto assets/networks offered for order payments. Network values match
 * the receive_wallets.network CHECK constraint — the wallet lookup and the
 * order_payments insert both depend on these exact strings. Shared by
 * NewOrderForm and the order drawer's Add Payment form.
 */
export const ASSETS = ['USDC', 'USDT', 'ETH', 'SOL', 'BTC'];

export const NETWORKS: Record<string, string[]> = {
  USDC: ['ethereum', 'solana'], USDT: ['ethereum', 'solana'], ETH: ['ethereum'], SOL: ['solana'], BTC: ['bitcoin'],
};

export const NETWORK_LABELS: Record<string, string> = { ethereum: 'Ethereum', solana: 'Solana', bitcoin: 'Bitcoin' };
