import { action } from '@uibakery/data';

/** Payout addresses are informational (nothing references them) — free delete. */
function deleteUserPayoutAddress() {
  return action('deleteUserPayoutAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM user_payout_addresses
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}
export default deleteUserPayoutAddress;
