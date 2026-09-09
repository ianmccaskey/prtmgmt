import { action } from '@uibakery/data';

/**
 * Queues a test text through the real SMS outbox — the browser can't call
 * Twilio (credentials live only in the GitHub Actions sync), so the test
 * rides the exact production path: the next sync run (≤5 min) sends it.
 * Uses the phone passed in (the field's current value), not the saved one,
 * so the admin can test before saving.
 */
export function queueTestSms() {
  return action('queueTestSms', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO sms_outbox (warehouse_id, sales_order_id, to_phone, body, status)
      SELECT w.id, NULL, {{params.phone}},
        'PRT Ops: test message — SMS notifications for ' || w.name || ' are working.',
        'pending'
      FROM warehouses w WHERE w.id = {{params.warehouse_id}}::bigint
      RETURNING id
    `,
  });
}

export default queueTestSms;
