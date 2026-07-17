import { action } from '@uibakery/data';

/**
 * Sellable stock (passed-QC, minus reservations) per product per active
 * warehouse. Drives the order form's fulfillment-warehouse suggestion:
 * "which single warehouse can fill every line?"
 */
function listWarehouseAvailability() {
  return action('listWarehouseAvailability', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT i.product_id, i.warehouse_id, w.name AS warehouse_name,
        SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))::int AS available
      FROM inventory i
      JOIN product_batches pb ON pb.id = i.batch_id AND pb.qc_status = 'passed'
      JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active = true
      GROUP BY i.product_id, i.warehouse_id, w.name
    `,
  });
}
export default listWarehouseAvailability;
