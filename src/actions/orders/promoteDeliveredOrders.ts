import { action } from '@uibakery/data';

/**
 * Self-healing sweep run after each tracking sync: any fully-shipped order
 * whose every outbound shipment is delivered becomes delivered. Covers the
 * race where two concurrent syncs each deliver a sibling shipment of the
 * same order and neither statement's snapshot sees the other's flip.
 */
function promoteDeliveredOrders() {
  return action('promoteDeliveredOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH ord AS (
        UPDATE sales_orders so SET status = 'delivered'
        WHERE so.status = 'shipped'
          AND EXISTS (SELECT 1 FROM shipments_outbound o WHERE o.sales_order_id = so.id)
          AND NOT EXISTS (SELECT 1 FROM shipments_outbound o WHERE o.sales_order_id = so.id AND o.status <> 'delivered')
        RETURNING so.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
      SELECT ord.id, NULL, 'status', 'status', 'shipped', 'delivered', 'Auto-delivered via Shippo tracking'
      FROM ord
      RETURNING sales_order_id
    `,
  });
}

export default promoteDeliveredOrders;
