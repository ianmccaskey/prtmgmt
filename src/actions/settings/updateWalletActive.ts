import { action } from '@uibakery/data';
function updateWalletActive() {
  return action('updateWalletActive', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `UPDATE receive_wallets SET is_active = {{params.is_active}} WHERE id = {{params.id}}`,
  });
}
export default updateWalletActive;
