import { action } from '@uibakery/data';

function listTransfers() {
  return action('listTransfers', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        iwt.id, iwt.product_id, iwt.batch_id, iwt.quantity,
        iwt.status, iwt.initiated_at, iwt.received_at, iwt.notes,
        p.sku, p.name AS product_name,
        pb.batch_number,
        ws.name AS source_warehouse_name, ws.id AS source_warehouse_id,
        wd.name AS destination_warehouse_name, wd.id AS destination_warehouse_id,
        DATE_PART('day', NOW() - iwt.initiated_at) AS days_in_transit
      FROM inter_warehouse_transfers iwt
      JOIN products p ON p.id = iwt.product_id
      LEFT JOIN product_batches pb ON pb.id = iwt.batch_id
      LEFT JOIN warehouses ws ON ws.id = iwt.source_warehouse_id
      LEFT JOIN warehouses wd ON wd.id = iwt.destination_warehouse_id
      WHERE (COALESCE({{params.status}}, '') = '' OR iwt.status = {{params.status}})
        AND (COALESCE({{params.warehouse_id}}, '') = '' OR
             iwt.source_warehouse_id::text = {{params.warehouse_id}} OR
             iwt.destination_warehouse_id::text = {{params.warehouse_id}})
      ORDER BY iwt.initiated_at DESC
    `,
  });
}

export default listTransfers;
