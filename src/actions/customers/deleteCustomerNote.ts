import { action } from '@uibakery/data';

export function deleteCustomerNote() {
  return action('deleteCustomerNote', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO customer_note_audit_log (customer_note_id, changed_by_user_id, changed_at, action, old_text, new_text)
      SELECT id, {{params.userId}}, NOW(), 'delete', note_text, NULL
      FROM customer_notes WHERE id = {{params.noteId}}::bigint;

      DELETE FROM customer_notes WHERE id = {{params.noteId}}::bigint;
    `,
  });
}

export default deleteCustomerNote;
