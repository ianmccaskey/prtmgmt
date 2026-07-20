import { action } from '@uibakery/data';

/** Save the signed-in user's label return address ('' clears a field). */
function updateMyLabelReturnAddress() {
  return action('updateMyLabelReturnAddress', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE user_profiles SET
        label_return_name = NULLIF({{params.name}}::text, ''),
        label_return_line1 = NULLIF({{params.line1}}::text, ''),
        label_return_line2 = NULLIF({{params.line2}}::text, ''),
        label_return_city = NULLIF({{params.city}}::text, ''),
        label_return_state = NULLIF({{params.state}}::text, ''),
        label_return_postal = NULLIF({{params.postal}}::text, ''),
        label_return_country = NULLIF({{params.country}}::text, ''),
        label_return_phone = NULLIF({{params.phone}}::text, '')
      WHERE id = {{params.user_id}}::bigint
      RETURNING id
    `,
  });
}

export default updateMyLabelReturnAddress;
