import { action } from '@uibakery/data';

/**
 * Payout addresses of every user assigned to a warehouse — shown when
 * recording a warehouse commission payment so the payer knows where to
 * send it.
 */
function listWarehousePayoutAddresses() {
  return action('listWarehousePayoutAddresses', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT pa.id, pa.asset, pa.network, pa.address, pa.label,
             up.display_name
      FROM user_payout_addresses pa
      JOIN user_profiles up ON up.id = pa.user_profile_id
      WHERE up.assigned_warehouse_id = {{params.warehouse_id}}::bigint
      ORDER BY up.display_name ASC, pa.asset ASC
    `,
  });
}
export default listWarehousePayoutAddresses;
