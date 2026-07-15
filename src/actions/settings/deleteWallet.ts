import { action } from '@uibakery/data';

/**
 * Delete a receive wallet — only when no payment references it (payment
 * history keeps its wallet link). Empty result = blocked; deactivate
 * instead.
 */
function deleteWallet() {
  return action('deleteWallet', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM receive_wallets w
      WHERE w.id = {{params.id}}::bigint
        AND NOT EXISTS (SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id)
      RETURNING w.id
    `,
  });
}
export default deleteWallet;
