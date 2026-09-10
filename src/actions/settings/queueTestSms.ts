import { action } from '@uibakery/data';

/**
 * Queues a test push through the real notification outbox — the test
 * rides the exact production path: the next sync run (≤5 min) POSTs it
 * to the ntfy topic. Uses the topic passed in (the field's current
 * value), not the saved one, so the admin can test before saving.
 */
export function queueTestSms() {
  return action('queueTestSms', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO sms_outbox (warehouse_id, sales_order_id, destination, body, status)
      SELECT w.id, NULL, {{params.topic}},
        'PRT Ops: test message — notifications for ' || w.name || ' are working.',
        'pending'
      FROM warehouses w WHERE w.id = {{params.warehouse_id}}::bigint AND w.is_active
      RETURNING id
    `,
  });
}

export default queueTestSms;
