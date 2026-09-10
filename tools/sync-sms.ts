/**
 * Pushes a notification to a warehouse when an order is newly assigned
 * to it. "Assigned" = the order has active reservations at that
 * warehouse (the same membership rule that puts it in the warehouse's
 * fulfillment queue), regardless of which path created them — order
 * confirm, a warehouse move, or a manual re-reserve.
 *
 * Delivery is ntfy push (https://ntfy.sh): warehouse staff install the
 * ntfy app and subscribe to a secret per-warehouse topic; this tool
 * POSTs the message to that topic. SMS was abandoned — US carriers
 * require registered-business sender identities for application SMS on
 * every provider (Twilio suspended the account; AWS SNS needs a
 * toll-free/10DLC business registration). The topic name is the only
 * secret: anyone who knows it can read and post, so topics must be
 * unguessable (the settings dialog generates them).
 *
 * Delivery discipline (a push is an external side effect — worse to
 * duplicate than to delay):
 *  - CLAIM-then-send: each (warehouse, order) pair is first claimed as a
 *    'pending' sms_outbox row (UNIQUE key, ON CONFLICT DO NOTHING); only
 *    the run that wins the claim sends. Overlapping runs can't double-send.
 *  - A crash between claim and result leaves a stale 'pending' row; the
 *    sweeper flips pendings older than 30 min to 'failed' so the retry
 *    path (max 3 attempts) picks them up.
 *  - Warehouses with no notify_topic get a 'no_phone' row (legacy status
 *    name; means "no destination configured") so the pair doesn't
 *    re-trigger every run; if a topic is added within 24h of the
 *    assignment, the row re-arms and the push goes out. Older ones stay
 *    silent by design (notifications are for FUTURE work once configured).
 *
 * Runs from .github/workflows/sms-sync.yml every 5 minutes (also safe
 * locally). Environment:
 *   DATABASE_URL   Neon connection string (shared with other syncs)
 *   NTFY_SERVER    optional — self-hosted ntfy base URL
 *                  (default https://ntfy.sh)
 *
 * Message content is deliberately minimal — order number and kit count
 * only, no product names or customer details (topics are bearer-secret,
 * not authenticated).
 */
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set (see .env.local).'); process.exit(1); }
const NTFY_SERVER = (process.env.NTFY_SERVER?.trim() || 'https://ntfy.sh').replace(/\/+$/, '');
const DRY = process.argv.includes('--dry-run');
const sql = new SQL(url);

/**
 * Topics are hand-entered (or generated) in the settings dialog; ntfy
 * allows [A-Za-z0-9_-]{1,64}. Anything else is refused here fail-closed
 * — a malformed topic would otherwise change the request PATH (e.g. a
 * '/' or '..' walks to a different endpoint), not just fail delivery.
 */
function validTopic(topic: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(topic);
}

async function sendPush(topic: string, body: string): Promise<void> {
  if (!validTopic(topic)) throw new Error(`ntfy: invalid topic ${JSON.stringify(topic.slice(0, 80))} — allowed: letters, digits, - and _, max 64 chars`);
  const res = await fetch(`${NTFY_SERVER}/${topic}`, {
    method: 'POST',
    headers: {
      Title: 'PRT Ops',
      Priority: 'high',
      Tags: 'package',
    },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string; code?: number } | null;
    throw new Error(`ntfy ${res.status}${err?.code ? ` [${err.code}]` : ''}: ${err?.error ?? 'send failed'}`);
  }
}

type Work = {
  outbox_id: number; warehouse_id: number; sales_order_id: number | null;
  warehouse_name: string; destination: string; order_number: string | null;
  kits: number; body: string | null;
};

async function main() {
  if (DRY) {
    // Read-only preview: mutate nothing (no sweeper, no claims, no
    // re-arms) — a dry run must not arm future real sends.
    const preview = await sql`
      SELECT DISTINCT so.order_number, w.name AS warehouse_name,
        NULLIF(TRIM(COALESCE(w.notify_topic, '')), '') IS NOT NULL AS has_topic
      FROM inventory_reservations ir
      JOIN inventory i ON i.id = ir.inventory_id
      JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active
      JOIN sales_orders so ON so.id = ir.sales_order_id
      WHERE ir.sales_order_id IS NOT NULL
        AND so.status IN ('confirmed', 'partially_shipped')
        AND NOT EXISTS (SELECT 1 FROM sms_outbox ob
          WHERE ob.warehouse_id = i.warehouse_id AND ob.sales_order_id = ir.sales_order_id)
    ` as { order_number: string; warehouse_name: string; has_topic: boolean }[];
    const backlog = await sql`
      SELECT COUNT(*)::int AS n FROM sms_outbox
      WHERE status = 'pending' OR (status = 'failed' AND attempts < 3)` as { n: number }[];
    for (const p of preview) console.log(`DRY: would notify ${p.warehouse_name} about ${p.order_number}${p.has_topic ? '' : ' (no topic — would record no_phone)'}`);
    console.log(`DRY: ${preview.length} new pair(s), ${backlog[0]?.n ?? 0} pending/retryable in backlog. Nothing written.`);
    return;
  }

  // Sweeper: pendings older than 30 min are crash leftovers → retryable.
  await sql`
    UPDATE sms_outbox SET status = 'failed',
      last_error = COALESCE(last_error, 'stale pending — run died between claim and result')
    WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'`;

  // CLAIM new assignments: insert pending rows for active-order
  // reservation pairs with no outbox row. Only rows actually inserted
  // here are ours to send — overlapping runs lose the conflict.
  const claimed = await sql`
    INSERT INTO sms_outbox (warehouse_id, sales_order_id, destination, status)
    SELECT DISTINCT i.warehouse_id, ir.sales_order_id, NULLIF(TRIM(COALESCE(w.notify_topic, '')), ''),
      CASE WHEN NULLIF(TRIM(COALESCE(w.notify_topic, '')), '') IS NULL THEN 'no_phone' ELSE 'pending' END
    FROM inventory_reservations ir
    JOIN inventory i ON i.id = ir.inventory_id
    JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active
    JOIN sales_orders so ON so.id = ir.sales_order_id
    WHERE ir.sales_order_id IS NOT NULL
      AND so.status IN ('confirmed', 'partially_shipped')
      AND NOT EXISTS (
        SELECT 1 FROM sms_outbox ob
        WHERE ob.warehouse_id = i.warehouse_id AND ob.sales_order_id = ir.sales_order_id)
    LIMIT 50
    ON CONFLICT (warehouse_id, sales_order_id) DO NOTHING
    RETURNING id, status` as { id: number; status: string }[];

  // Re-arm recent no-destination rows whose warehouse has a topic now (24h grace).
  await sql`
    UPDATE sms_outbox ob SET status = 'pending', destination = TRIM(w.notify_topic)
    FROM warehouses w
    WHERE w.id = ob.warehouse_id AND ob.status = 'no_phone'
      AND ob.created_at > NOW() - INTERVAL '24 hours'
      AND NULLIF(TRIM(COALESCE(w.notify_topic, '')), '') IS NOT NULL`;

  console.log(`claimed ${claimed.filter(c => c.status === 'pending').length} new, ${claimed.filter(c => c.status === 'no_phone').length} no-destination`);

  // Send loop: each row is OWNED for the duration of its send via
  // FOR UPDATE SKIP LOCKED inside a per-row transaction — a concurrent
  // run (cron vs local) skips locked rows instead of double-sending.
  // A crash mid-transaction rolls the row back to pending; the sweeper
  // retries it later.
  let sent = 0, failed = 0, processed = 0;
  while (processed < 60) {
    processed++;
    const done = await sql.begin(async (tx: typeof sql) => {
      // LEFT JOIN sales_orders: test pushes (queueTestSms) have no order —
      // they always carry a stored body and their own destination. The
      // effective destination prefers the row's own (a test uses the
      // topic as typed, even if unsaved) over the warehouse default.
      const rows = await tx`
        SELECT ob.id AS outbox_id, ob.warehouse_id, ob.sales_order_id, ob.body,
          w.name AS warehouse_name,
          COALESCE(NULLIF(TRIM(COALESCE(ob.destination, '')), ''), TRIM(w.notify_topic)) AS destination,
          so.order_number,
          (SELECT COALESCE(SUM(ir.quantity), 0) FROM inventory_reservations ir
           JOIN inventory i ON i.id = ir.inventory_id
           WHERE ir.sales_order_id = ob.sales_order_id AND i.warehouse_id = ob.warehouse_id)::int AS kits
        FROM sms_outbox ob
        JOIN warehouses w ON w.id = ob.warehouse_id AND w.is_active
        LEFT JOIN sales_orders so ON so.id = ob.sales_order_id
        WHERE (ob.status = 'pending' OR (ob.status = 'failed' AND ob.attempts < 3))
          AND COALESCE(NULLIF(TRIM(COALESCE(ob.destination, '')), ''), NULLIF(TRIM(COALESCE(w.notify_topic, '')), '')) IS NOT NULL
        ORDER BY ob.id
        FOR UPDATE OF ob SKIP LOCKED
        LIMIT 1
      ` as Work[];
      const p = rows[0];
      if (!p) return false;
      // Stored body (tests and retries keep their original message); else compose.
      const body = p.body || `PRT Ops: order ${p.order_number} assigned to ${p.warehouse_name} — ${p.kits} kit(s). Check the fulfillment queue.`;
      try {
        await sendPush(p.destination, body);
        await tx`UPDATE sms_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(),
          destination = ${p.destination}, body = ${body}, last_error = NULL
          WHERE id = ${p.outbox_id}`;
        sent++;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        await tx`UPDATE sms_outbox SET status = 'failed', attempts = attempts + 1,
          destination = ${p.destination}, body = ${body}, last_error = ${msg}
          WHERE id = ${p.outbox_id}`;
        failed++;
        console.error(`${p.order_number ?? '(test)'} → ${p.warehouse_name}: ${msg}`);
      }
      return true;
    });
    if (!done) break;
  }
  console.log(`sent=${sent} failed=${failed}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
