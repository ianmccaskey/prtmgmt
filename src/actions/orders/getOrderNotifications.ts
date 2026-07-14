import { action } from '@uibakery/data';

function getOrderNotifications() {
  return action('getOrderNotifications', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, shipment_id, channel, recipient, subject, status, created_at, sent_at
      FROM notifications_sent
      WHERE sales_order_id = {{params.orderId}}::bigint
      ORDER BY created_at DESC
    `,
  });
}

export default getOrderNotifications;
