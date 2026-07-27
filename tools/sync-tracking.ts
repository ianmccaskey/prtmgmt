/**
 * Server-side Shippo tracking sync.
 *
 * Polls Shippo for every in-transit outbound shipment, records the tracking
 * status, flips DELIVERED shipments (and their orders, once every shipment
 * has landed) exactly like the in-app SQL actions did. This runs OUTSIDE the
 * browser because Shippo's /tracks endpoints require the Authorization
 * header but their CORS preflight never allows it — a browser can purchase
 * labels against api.goshippo.com, but tracking requests die at preflight.
 *
 * Invoked by .github/workflows/tracking-sync.yml every 30 minutes (needs the
 * DATABASE_URL repo secret), or locally:
 *
 *   bun tools/sync-tracking.ts
 *
 * with DATABASE_URL in the environment or in .env.local at the repo root.
 * The Shippo key comes from the database (the warehouse designated in
 * app_settings.shippo_tracking_warehouse_id) — tracking is account-agnostic
 * on Shippo's side, so one key tracks every carrier/number.
 */
import { SQL } from 'bun';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (env or .env.local at the repo root).');
  process.exit(1);
}
const sql = new SQL(url);

// Matches src/lib/shippo.ts trackingCarrierToken.
const CARRIER_TOKENS: Record<string, string> = {
  USPS: 'usps', UPS: 'ups', FedEx: 'fedex', DHL: 'dhl_express',
};

type TrackRow = {
  id: number; sales_order_id: number; carrier: string;
  tracking_number: string; tracking_status: string | null;
};

const keyRows = await sql`
  SELECT w.shippo_api_key
  FROM warehouses w
  JOIN app_settings s ON s.key = 'shippo_tracking_warehouse_id' AND s.value = w.id::text
  WHERE COALESCE(w.shippo_api_key, '') <> ''` as { shippo_api_key: string }[];
const apiKey = keyRows[0]?.shippo_api_key;
if (!apiKey) {
  console.log('No tracking Shippo key configured (Settings → Warehouses) — nothing to do.');
  process.exit(0);
}

// Same population and throttle as the old in-app listTrackableShipments.
const ships = await sql`
  SELECT so2.id, so2.sales_order_id, so2.carrier, so2.tracking_number, so2.tracking_status
  FROM shipments_outbound so2
  WHERE so2.status = 'in_transit'
    AND so2.tracking_number IS NOT NULL
    AND so2.carrier IN ('USPS', 'UPS', 'FedEx', 'DHL')
    AND (so2.tracking_checked_at IS NULL OR so2.tracking_checked_at < NOW() - INTERVAL '25 minutes')
    AND (so2.tracking_status IS NULL OR so2.tracking_status NOT IN ('RETURNED', 'FAILURE'))
  ORDER BY so2.id
  LIMIT 100` as TrackRow[];

console.log(`${ships.length} shipment(s) due for a tracking poll.`);
let delivered = 0, updated = 0, failed = 0;

for (const s of ships) {
  const token = CARRIER_TOKENS[s.carrier];
  const num = String(s.tracking_number).replace(/^#/, '').trim();
  let status: string | null = null;
  let statusDate: string | null = null;
  try {
    const res = await fetch(`https://api.goshippo.com/tracks/${token}/${encodeURIComponent(num)}`, {
      headers: { Authorization: `ShippoToken ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json() as { tracking_status?: { status?: string; status_date?: string } | null };
      status = data?.tracking_status?.status || null;
      statusDate = data?.tracking_status?.status_date || null;
    } else {
      console.error(`  shipment ${s.id} (${s.carrier} ${num}): HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`  shipment ${s.id} (${s.carrier} ${num}): ${e instanceof Error ? e.message : e}`);
  }

  try {
    if (status === 'DELIVERED') {
      // Mirrors src/actions/orders/markShipmentDeliveredByTracking.ts —
      // atomic shipment flip + order promotion + audit row.
      await sql`
        WITH ship AS (
          UPDATE shipments_outbound SET
            status = 'delivered',
            delivered_date = COALESCE(delivered_date, ${statusDate ? statusDate.slice(0, 10) : null}::date, CURRENT_DATE),
            tracking_status = 'DELIVERED',
            tracking_checked_at = NOW()
          WHERE id = ${s.id} AND status = 'in_transit'
          RETURNING id, sales_order_id
        ),
        ord AS (
          UPDATE sales_orders so SET status = 'delivered'
          FROM ship
          WHERE so.id = ship.sales_order_id
            AND so.status = 'shipped'
            AND NOT EXISTS (
              SELECT 1 FROM shipments_outbound o
              WHERE o.sales_order_id = so.id AND o.id <> ship.id AND o.status <> 'delivered'
            )
          RETURNING so.id
        )
        INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note)
        SELECT ord.id, NULL, 'status', 'status', 'shipped', 'delivered', 'Auto-delivered via Shippo tracking'
        FROM ord`;
      delivered++;
      console.log(`  shipment ${s.id} (${s.carrier} ${num}): DELIVERED`);
    } else {
      // Stamp the poll time even when Shippo had nothing usable, so the
      // row isn't permanently due.
      await sql`
        UPDATE shipments_outbound
        SET tracking_status = ${status ?? s.tracking_status ?? null}, tracking_checked_at = NOW()
        WHERE id = ${s.id}`;
      updated++;
      if (status) console.log(`  shipment ${s.id} (${s.carrier} ${num}): ${status}`);
    }
  } catch (e) {
    failed++;
    console.error(`  shipment ${s.id}: DB update failed — ${e instanceof Error ? e.message : e}`);
  }
}

// Self-healing sweep, mirrors src/actions/orders/promoteDeliveredOrders.ts.
const promoted = await sql`
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
  RETURNING sales_order_id` as { sales_order_id: number }[];

console.log(`Done: ${delivered} delivered, ${updated} status-stamped, ${failed} failed, ${promoted.length} order(s) promoted by sweep.`);
await sql.end();
