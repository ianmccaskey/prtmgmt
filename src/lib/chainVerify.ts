import { getTxDeposit } from './moralis';

/**
 * Shared on-chain TX verification for payment entry forms: does `txHash`
 * move at least `requiredUsd` of `asset` into `wallet` on `network`?
 * Advisory — callers render the message and decide what to do with the
 * verdict (typically auto-set their "payment received" toggle on ok/over).
 * Stablecoins are treated 1:1 with USD, matching the app's amount_usd
 * doctrine everywhere else.
 */
export type ChainCheck = {
  state: 'idle' | 'checking' | 'ok' | 'over' | 'short' | 'notfound' | 'error';
  msg: string;
};
export const IDLE_CHECK: ChainCheck = { state: 'idle', msg: '' };

export async function verifyTxCoversAmount(opts: {
  moralisKey: string;
  heliusKey?: string | null;
  asset: string;
  network: string;
  networkLabel: string;
  wallet: { address: string; label: string };
  txHash: string;
  requiredUsd: number;
  /** What the required amount is called in messages, e.g. "order total". */
  requiredLabel: string;
  /** Where the caller's swap flow lives, e.g. "in the order drawer". */
  swapFlowLocation: string;
}): Promise<ChainCheck> {
  const { asset, network, networkLabel, wallet, requiredUsd, requiredLabel } = opts;
  if (asset !== 'USDC' && asset !== 'USDT') {
    return { state: 'error', msg: `Only USDC and USDT can be checked here — verify a ${asset} payment manually on the explorer.` };
  }
  if (network !== 'ethereum' && network !== 'solana') {
    return { state: 'error', msg: `${networkLabel} can't be checked here — BTC payments verify through the swap flow ${opts.swapFlowLocation}.` };
  }
  if (!opts.moralisKey && network === 'ethereum') {
    return { state: 'error', msg: 'No Moralis API key configured — add one under Settings → Wallets to enable on-chain checks.' };
  }
  try {
    const hit = await getTxDeposit(opts.moralisKey, asset, network, wallet.address, opts.txHash.trim(), opts.heliusKey || null);
    if (!hit) {
      return { state: 'notfound', msg: `TX not found on ${networkLabel}, or it doesn't move ${asset} into ${wallet.label}. Check the hash, asset, and network.` };
    }
    const when = hit.at ? ` on ${new Date(hit.at).toLocaleString()}` : '';
    // Half-cent tolerance so float representation never fails an exact payment.
    if (hit.amount + 0.005 >= requiredUsd) {
      const over = hit.amount > requiredUsd + 0.005;
      return {
        state: over ? 'over' : 'ok',
        msg: `Verified: ${hit.amount.toFixed(2)} ${asset} arrived in ${wallet.label}${when}` +
          (over
            ? ` — $${(hit.amount - requiredUsd).toFixed(2)} more than the $${requiredUsd.toFixed(2)} ${requiredLabel}.`
            : ` — covers the $${requiredUsd.toFixed(2)} ${requiredLabel}.`),
      };
    }
    return { state: 'short', msg: `On-chain deposit is ${hit.amount.toFixed(2)} ${asset}${when} — $${(requiredUsd - hit.amount).toFixed(2)} SHORT of the $${requiredUsd.toFixed(2)} ${requiredLabel}.` };
  } catch (e: unknown) {
    return { state: 'error', msg: e instanceof Error ? e.message : 'On-chain check failed — try again.' };
  }
}
