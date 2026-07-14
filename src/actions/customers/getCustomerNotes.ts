import { action } from '@uibakery/data';

export function getCustomerNotes() {
  return action('getCustomerNotes', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        cn.id,
        cn.customer_id,
        cn.note_text,
        cn.created_at,
        cn.author_user_id,
        up.display_name AS author_name
      FROM customer_notes cn
      LEFT JOIN user_profiles up ON up.user_id = cn.author_user_id
      WHERE cn.customer_id = {{params.customerId}}::bigint
      ORDER BY cn.created_at DESC
    `,
  });
}

export default getCustomerNotes;
