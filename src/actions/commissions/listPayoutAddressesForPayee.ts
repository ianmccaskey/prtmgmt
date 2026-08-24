import { action } from '@uibakery/data';

/**
 * The saved payout addresses to pay a settlement payee at: a user's own
 * addresses (reps, expense payees), or — for a warehouse — the addresses
 * of the users assigned to that warehouse (warehouses have no wallets of
 * their own; the operator gets paid).
 */
function listPayoutAddressesForPayee() {
  return action('listPayoutAddressesForPayee', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT pa.asset, pa.network, pa.address, pa.label, up.display_name
      FROM user_payout_addresses pa
      JOIN user_profiles up ON up.id = pa.user_profile_id
      WHERE ({{params.user_profile_id}}::bigint IS NOT NULL
             AND pa.user_profile_id = {{params.user_profile_id}}::bigint)
         OR ({{params.warehouse_id}}::bigint IS NOT NULL
             AND up.assigned_warehouse_id = {{params.warehouse_id}}::bigint)
      ORDER BY up.display_name, pa.asset, pa.network
    `,
  });
}

export default listPayoutAddressesForPayee;
