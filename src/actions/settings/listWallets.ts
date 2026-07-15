import { action } from '@uibakery/data';
function listWallets() {
  return action('listWallets', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT w.id, w.asset, w.network, w.address, w.label, w.is_active, w.notes,
        EXISTS(SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id) AS is_used
      FROM receive_wallets w
      ORDER BY w.asset ASC, w.network ASC
    `,
  });
}
export default listWallets;
