import { action } from '@uibakery/data';

function listUserPayoutAddresses() {
  return action('listUserPayoutAddresses', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, user_profile_id, asset, network, address, label
      FROM user_payout_addresses
      WHERE user_profile_id = {{params.user_profile_id}}::bigint
      ORDER BY asset ASC, network ASC
    `,
  });
}
export default listUserPayoutAddresses;
