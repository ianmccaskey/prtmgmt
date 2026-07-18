import { action } from '@uibakery/data';

/** Single statement (audit CTE + update) — multi-statement queries can't
 *  run as prepared statements. old_text comes from the live row. */
export function updateCustomerNote() {
  return action('updateCustomerNote', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH aud AS (
        INSERT INTO customer_note_audit_log (customer_note_id, changed_by_user_id, changed_at, action, old_text, new_text)
        SELECT id, {{params.userId}}, NOW(), 'edited', note_text, {{params.noteText}}
        FROM customer_notes WHERE id = {{params.noteId}}::bigint
      )
      UPDATE customer_notes
      SET note_text = {{params.noteText}}
      WHERE id = {{params.noteId}}::bigint
      RETURNING id
    `,
  });
}

export default updateCustomerNote;
