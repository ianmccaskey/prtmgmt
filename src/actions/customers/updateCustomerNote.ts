import { action } from '@uibakery/data';

export function updateCustomerNote() {
  return action('updateCustomerNote', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE customer_notes
      SET note_text = {{params.noteText}}
      WHERE id = {{params.noteId}}::bigint;

      INSERT INTO customer_note_audit_log (customer_note_id, changed_by_user_id, changed_at, action, old_text, new_text)
      VALUES (
        {{params.noteId}}::bigint,
        {{params.userId}},
        NOW(),
        'edit',
        {{params.oldText}},
        {{params.noteText}}
      );
    `,
  });
}

export default updateCustomerNote;
