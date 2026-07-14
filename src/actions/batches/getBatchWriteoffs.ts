import { action } from '@uibakery/data';

function getBatchWriteoffs() {
  return action('getBatchWriteoffs', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        iw.id, iw.quantity, iw.reason, iw.notes, iw.evidence_url,
        iw.source, iw.created_at,
        w.name AS warehouse_name,
        up.display_name AS created_by_name
      FROM inventory_writeoffs iw
      LEFT JOIN warehouses w ON w.id = iw.warehouse_id
      LEFT JOIN user_profiles up ON up.user_id = iw.created_by_user_id
      WHERE iw.batch_id = {{params.batch_id}}
      ORDER BY iw.created_at DESC
    `,
  });
}

export default getBatchWriteoffs;
