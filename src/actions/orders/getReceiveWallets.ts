import { action } from '@uibakery/data';

export function getReceiveWallets() {
  return action('getReceiveWallets', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, asset, network, address, label, division
      FROM receive_wallets
      WHERE is_active = true
        AND division = COALESCE(NULLIF({{params.division}}, ''), 'us')
      ORDER BY asset, network
    `,
  });
}

export default getReceiveWallets;
