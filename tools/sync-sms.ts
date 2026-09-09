/**
 * Texts a warehouse when an order is newly assigned to it. "Assigned" =
 * the order has active reservations at that warehouse (the same
 * membership rule that puts it in the warehouse's fulfillment queue),
 * regardless of which path created them — order confirm, a warehouse
 * move, or a manual re-reserve.
 *
 * Delivery discipline (an SMS is an external side effect — worse to
 * duplicate than to delay):
 *  - CLAIM-then-send: each (warehouse, order) pair is first claimed as a
 *    'pending' sms_outbox row (UNIQUE key, ON CONFLICT DO NOTHING); only
 *    the run that wins the claim sends. Overlapping runs can't double-text.
 *  - A crash between claim and result leaves a stale 'pending' row; the
 *    sweeper flips pendings older than 30 min to 'failed' so the retry
 *    path (max 3 attempts) picks them up.
 *  - Warehouses with no notify_phone get a 'no_phone' row so the pair
 *    doesn't re-trigger every run; if a phone is added within 24h of the
 *    assignment, the row re-arms and the text goes out. Older ones stay
 *    silent by design (notifications are for FUTURE work once configured).
 *
 * Runs from .github/workflows/sms-sync.yml every 5 minutes (also safe
 * locally). Environment:
 *   DATABASE_URL         Neon connection string (shared with other syncs)
 *   TWILIO_ACCOUNT_SID   Twilio account SID (AC…)
 *   TWILIO_AUTH_TOKEN    Twilio auth token
 *   TWILIO_FROM          the Twilio phone number to send from (+1…)
 *
 * SMS content is deliberately minimal — order number and kit count only,
 * no product names or customer details (carrier content filtering +
 * privacy).
 */
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;
if (!url) { console.error('DATABASE_URL is not set (see .env.local).'); process.exit(1); }
if (!SID || !TOKEN || !FROM) {
  console.error('Twilio env missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM are all required.');
  process.exit(1);
}
const DRY = process.argv.includes('--dry-run');
const sql = new SQL(url);

async function sendSms(to: string, body: string): Promise<void> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: FROM!, Body: body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { message?: string; code?: number } | null;
    throw new Error(`Twilio ${res.status}${err?.code ? ` [${err.code}]` : ''}: ${err?.message ?? 'send failed'}`);
  }
}

type Work = {
  outbox_id: number; warehouse_id: number; sales_order_id: number;
  warehouse_name: string; notify_phone: string; order_number: string;
  kits: number; body: string | null;
};

async function main() {
  // Sweeper: pendings older than 30 min are crash leftovers → retryable.
  await sql`
    UPDATE sms_outbox SET status = 'failed',
      last_error = COALESCE(last_error, 'stale pending — run died between claim and result')
    WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'`;

  // CLAIM new assignments: insert pending rows for active-order
  // reservation pairs with no outbox row. Only rows actually inserted
  // here are ours to send — overlapping runs lose the conflict.
  const claimed = await sql`
    INSERT INTO sms_outbox (warehouse_id, sales_order_id, to_phone, status)
    SELECT DISTINCT i.warehouse_id, ir.sales_order_id, NULLIF(TRIM(COALESCE(w.notify_phone, '')), ''),
      CASE WHEN NULLIF(TRIM(COALESCE(w.notify_phone, '')), '') IS NULL THEN 'no_phone' ELSE 'pending' END
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

  // Re-arm recent no_phone rows whose warehouse has a phone now (24h grace).
  await sql`
    UPDATE sms_outbox ob SET status = 'pending', to_phone = TRIM(w.notify_phone)
    FROM warehouses w
    WHERE w.id = ob.warehouse_id AND ob.status = 'no_phone'
      AND ob.created_at > NOW() - INTERVAL '24 hours'
      AND NULLIF(TRIM(COALESCE(w.notify_phone, '')), '') IS NOT NULL`;

  // Everything ours to send: fresh pendings + failed retries (max 3
  // attempts, and only where a phone exists so unsendables can't starve
  // the retry budget).
  const work = await sql`
    SELECT ob.id AS outbox_id, ob.warehouse_id, ob.sales_order_id, ob.body,
      w.name AS warehouse_name, TRIM(w.notify_phone) AS notify_phone,
      so.order_number,
      (SELECT COALESCE(SUM(ir.quantity), 0) FROM inventory_reservations ir
       JOIN inventory i ON i.id = ir.inventory_id
       WHERE ir.sales_order_id = ob.sales_order_id AND i.warehouse_id = ob.warehouse_id)::int AS kits
    FROM sms_outbox ob
    JOIN warehouses w ON w.id = ob.warehouse_id AND w.is_active
    JOIN sales_orders so ON so.id = ob.sales_order_id
    WHERE (ob.status = 'pending' OR (ob.status = 'failed' AND ob.attempts < 3))
      AND NULLIF(TRIM(COALESCE(w.notify_phone, '')), '') IS NOT NULL
    ORDER BY ob.id
    LIMIT 60
  ` as Work[];

  console.log(`claimed ${claimed.filter(c => c.status === 'pending').length} new, ${claimed.filter(c => c.status === 'no_phone').length} no-phone; ${work.length} to send`);

  let sent = 0, failed = 0;
  for (const p of work) {
    // Stored body (retries keep the original message); else compose.
    const body = p.body || `PRT Ops: order ${p.order_number} assigned to ${p.warehouse_name} — ${p.kits} kit(s). Check the fulfillment queue.`;
    if (DRY) { console.log(`DRY: would text ${p.notify_phone}: ${body}`); continue; }
    try {
      await sendSms(p.notify_phone, body);
      await sql`UPDATE sms_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(),
        to_phone = ${p.notify_phone}, body = ${body}, last_error = NULL
        WHERE id = ${p.outbox_id}`;
      sent++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await sql`UPDATE sms_outbox SET status = 'failed', attempts = attempts + 1,
        to_phone = ${p.notify_phone}, body = ${body}, last_error = ${msg}
        WHERE id = ${p.outbox_id}`;
      failed++;
      console.error(`${p.order_number} → ${p.warehouse_name}: ${msg}`);
    }
  }
  console.log(`sent=${sent} failed=${failed}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
