import { action } from '@uibakery/data';

/** Restore an archived inventory row to the warehouse list. */
function unarchiveInventoryRow() {
  return action('unarchiveInventoryRow', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE inventory SET archived_at = NULL
      WHERE id = {{params.id}}::bigint AND archived_at IS NOT NULL
      RETURNING id
    `,
  });
}

export default unarchiveInventoryRow;
