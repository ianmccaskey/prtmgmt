import { action } from '@uibakery/data';
function createWallet() {
  return action('createWallet', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `INSERT INTO receive_wallets (asset, network, address, label, is_active, notes) VALUES ({{params.asset}}, {{params.network}}, {{params.address}}, {{params.label}}, true, {{params.notes}}) RETURNING id`,
  });
}
export default createWallet;
