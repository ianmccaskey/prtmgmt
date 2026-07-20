import { action } from '@uibakery/data';

/**
 * The signed-in user's Shippo label return address. Postal and phone carry
 * the '#' guard (client numeric parsing) — strip with dbText().
 */
function getMyLabelReturnAddress() {
  return action('getMyLabelReturnAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, label_return_name, label_return_line1, label_return_line2,
        label_return_city, label_return_state,
        '#' || label_return_postal AS label_return_postal,
        label_return_country,
        '#' || label_return_phone AS label_return_phone
      FROM user_profiles
      WHERE id = {{params.user_id}}::bigint
    `,
  });
}

export default getMyLabelReturnAddress;
