import { action } from '@uibakery/data';

/**
 * Log a pending shipping notification for a new outbound shipment. Composes
 * subject/body from the shipment + customer so a later email integration can
 * send it verbatim. Email is the fallback channel — reps copy tracking into
 * the customer's chat app from the order drawer.
 */
function createShipmentNotification() {
  return action('createShipmentNotification', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO notifications_sent (sales_order_id, shipment_id, channel, recipient, subject, body, status)
      SELECT
        so.id, sob.id, 'email', c.email,
        'Your order ' || so.order_number || ' has shipped',
        'Carrier: ' || COALESCE(sob.carrier, '—') ||
          E'\\nTracking: ' || COALESCE(sob.tracking_number, '—') ||
          E'\\nShipped: ' || COALESCE(sob.shipped_date::text, '—'),
        'pending'
      FROM shipments_outbound sob
      JOIN sales_orders so ON so.id = sob.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      WHERE sob.id = {{params.shipment_id}}::bigint
      RETURNING id
    `,
  });
}

export default createShipmentNotification;
