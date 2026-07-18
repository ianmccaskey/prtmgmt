import { action } from '@uibakery/data';

function createUserPayoutAddress() {
  return action('createUserPayoutAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO user_payout_addresses (user_profile_id, asset, network, address, label)
      VALUES ({{params.user_profile_id}}::bigint, {{params.asset}}, {{params.network}}, TRIM({{params.address}}), {{params.label}})
      RETURNING id
    `,
  });
}
export default createUserPayoutAddress;
