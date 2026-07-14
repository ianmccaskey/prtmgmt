import { action } from '@uibakery/data';

function getBatchTransfers() {
  return action('getBatchTransfers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        iwt.id, iwt.quantity, iwt.status, iwt.initiated_at, iwt.received_at, iwt.notes,
        ws.name AS source_warehouse_name,
        wd.name AS destination_warehouse_name
      FROM inter_warehouse_transfers iwt
      LEFT JOIN warehouses ws ON ws.id = iwt.source_warehouse_id
      LEFT JOIN warehouses wd ON wd.id = iwt.destination_warehouse_id
      WHERE iwt.batch_id = {{params.batch_id}}
      ORDER BY iwt.initiated_at DESC
    `,
  });
}

export default getBatchTransfers;
