import { action } from '@uibakery/data';

export function createCustomerNote() {
  return action('createCustomerNote', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO customer_notes (customer_id, author_user_id, note_text, created_at)
      VALUES ({{params.customerId}}::bigint, {{params.userId}}, {{params.noteText}}, NOW())
      RETURNING id
    `,
  });
}

export default createCustomerNote;
