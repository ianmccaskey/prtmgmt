import { action } from '@uibakery/data';

function listWarehouseActivity() {
  return action('listWarehouseActivity', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        wal.id, wal.event_at, wal.event_type, wal.quantity_delta,
        wal.source_record_type, wal.source_record_id, wal.notes,
        w.name AS warehouse_name,
        p.sku, p.name AS product_name,
        pb.batch_number,
        up.display_name AS actor_name
      FROM warehouse_activity_log wal
      LEFT JOIN warehouses w ON w.id = wal.warehouse_id
      LEFT JOIN products p ON p.id = wal.product_id
      LEFT JOIN product_batches pb ON pb.id = wal.batch_id
      LEFT JOIN user_profiles up ON up.id = wal.actor_user_id
      WHERE
        (COALESCE({{params.warehouse_id}}, '') = '' OR wal.warehouse_id::text = {{params.warehouse_id}})
        AND (COALESCE({{params.event_type}}, '') = '' OR wal.event_type = {{params.event_type}})
        AND ({{params.date_from}} IS NULL OR wal.event_at >= {{params.date_from}}::timestamptz)
        AND ({{params.date_to}} IS NULL OR wal.event_at <= {{params.date_to}}::timestamptz)
      ORDER BY wal.event_at DESC
      LIMIT 1000
    `,
  });
}

export default listWarehouseActivity;
