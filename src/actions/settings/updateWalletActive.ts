import { action } from '@uibakery/data';

/**
 * Toggle a wallet's active flag. Activation is refused (empty result) when
 * another active wallet already covers the same asset/network — the
 * one-active-wallet-per-combo invariant is enforced here so it can't be
 * bypassed by editing an inactive wallet into a taken combo and flipping
 * it on. Deactivation always succeeds.
 */
function updateWalletActive() {
  return action('updateWalletActive', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE receive_wallets w
      SET is_active = {{params.is_active}}
      WHERE w.id = {{params.id}}::bigint
        AND (
          {{params.is_active}}::boolean = false
          OR NOT EXISTS (
            SELECT 1 FROM receive_wallets o
            WHERE o.id <> w.id AND o.is_active AND o.asset = w.asset AND o.network = w.network
          )
        )
      RETURNING w.id
    `,
  });
}
export default updateWalletActive;
