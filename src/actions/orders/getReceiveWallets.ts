import { action } from '@uibakery/data';

export function getReceiveWallets() {
  return action('getReceiveWallets', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, asset, network, address, label
      FROM receive_wallets
      WHERE is_active = true
      ORDER BY asset, network
    `,
  });
}

export default getReceiveWallets;
