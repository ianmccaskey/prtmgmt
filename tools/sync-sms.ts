/**
 * Texts a warehouse when an order is newly assigned to it. "Assigned" =
 * the order has active reservations at that warehouse (the same
 * membership rule that puts it in the warehouse's fulfillment queue),
 * regardless of which path created them — order confirm, a warehouse
 * move, or a manual re-reserve. One SMS per (warehouse, order), deduped
 * by the sms_outbox unique key; the migration backfilled existing pairs
 * so only NEW assignments text.
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

type Pair = {
  warehouse_id: number; sales_order_id: number; warehouse_name: string;
  notify_phone: string | null; order_number: string; kits: number;
};

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

async function main() {
  // New assignments: active-order reservations at a warehouse with no
  // outbox row yet. Cancelled/delivered orders don't need a ping.
  const pairs = await sql`
    SELECT DISTINCT i.warehouse_id, ir.sales_order_id,
      w.name AS warehouse_name, w.notify_phone,
      so.order_number,
      (SELECT COALESCE(SUM(ir2.quantity), 0) FROM inventory_reservations ir2
       JOIN inventory i2 ON i2.id = ir2.inventory_id
       WHERE ir2.sales_order_id = ir.sales_order_id AND i2.warehouse_id = i.warehouse_id)::int AS kits
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
  ` as Pair[];

  // Retry recent failures (max 3 attempts).
  const retries = await sql`
    SELECT ob.warehouse_id, ob.sales_order_id, w.name AS warehouse_name,
      w.notify_phone, so.order_number, 0 AS kits
    FROM sms_outbox ob
    JOIN warehouses w ON w.id = ob.warehouse_id AND w.is_active
    JOIN sales_orders so ON so.id = ob.sales_order_id
    WHERE ob.status = 'failed' AND ob.attempts < 3
    LIMIT 20
  ` as Pair[];

  console.log(`${pairs.length} new assignment(s), ${retries.length} retry(ies)`);
  let sent = 0, failed = 0, noPhone = 0;

  for (const p of pairs) {
    const body = `PRT Ops: order ${p.order_number} assigned to ${p.warehouse_name} — ${p.kits} kit(s). Check the fulfillment queue.`;
    if (!p.notify_phone || !p.notify_phone.trim()) {
      // Record the pair so it never re-triggers, but mark why nothing sent.
      await sql`
        INSERT INTO sms_outbox (warehouse_id, sales_order_id, to_phone, body, status)
        VALUES (${p.warehouse_id}, ${p.sales_order_id}, NULL, ${body}, 'no_phone')
        ON CONFLICT (warehouse_id, sales_order_id) DO NOTHING`;
      noPhone++;
      continue;
    }
    if (DRY) { console.log(`DRY: would text ${p.notify_phone}: ${body}`); continue; }
    try {
      await sendSms(p.notify_phone.trim(), body);
      await sql`
        INSERT INTO sms_outbox (warehouse_id, sales_order_id, to_phone, body, status, attempts, sent_at)
        VALUES (${p.warehouse_id}, ${p.sales_order_id}, ${p.notify_phone.trim()}, ${body}, 'sent', 1, NOW())
        ON CONFLICT (warehouse_id, sales_order_id) DO UPDATE
          SET status = 'sent', attempts = sms_outbox.attempts + 1, sent_at = NOW(), last_error = NULL`;
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`
        INSERT INTO sms_outbox (warehouse_id, sales_order_id, to_phone, body, status, attempts, last_error)
        VALUES (${p.warehouse_id}, ${p.sales_order_id}, ${p.notify_phone.trim()}, ${body}, 'failed', 1, ${msg.slice(0, 500)})
        ON CONFLICT (warehouse_id, sales_order_id) DO UPDATE
          SET status = 'failed', attempts = sms_outbox.attempts + 1, last_error = ${msg.slice(0, 500)}`;
      failed++;
      console.error(`${p.order_number} → ${p.warehouse_name}: ${msg}`);
    }
  }

  for (const p of retries) {
    if (!p.notify_phone || DRY) continue;
    const body = `PRT Ops: order ${p.order_number} assigned to ${p.warehouse_name}. Check the fulfillment queue.`;
    try {
      await sendSms(p.notify_phone.trim(), body);
      await sql`UPDATE sms_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), last_error = NULL
        WHERE warehouse_id = ${p.warehouse_id} AND sales_order_id = ${p.sales_order_id}`;
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`UPDATE sms_outbox SET attempts = attempts + 1, last_error = ${msg.slice(0, 500)}
        WHERE warehouse_id = ${p.warehouse_id} AND sales_order_id = ${p.sales_order_id}`;
      failed++;
    }
  }

  console.log(`sent=${sent} failed=${failed} no_phone=${noPhone}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
