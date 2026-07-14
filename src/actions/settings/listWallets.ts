import { action } from '@uibakery/data';
function listWallets() {
  return action('listWallets', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT id, asset, network, address, label, is_active, notes FROM receive_wallets ORDER BY asset ASC, network ASC`,
  });
}
export default listWallets;
