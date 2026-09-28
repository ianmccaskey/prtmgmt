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
 * Invoked by .github/workflows/tracking-sync.yml (cron-job.org, hourly; needs the
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

async function main() {
const keyRows = await sql`
  SELECT w.shippo_api_key
  FROM warehouses w
  JOIN app_settings s ON s.key = 'shippo_tracking_warehouse_id' AND s.value = w.id::text
  WHERE w.is_active = true AND COALESCE(w.shippo_api_key, '') <> ''` as { shippo_api_key: string }[];
const apiKey = keyRows[0]?.shippo_api_key;
if (!apiKey) {
  console.log('No tracking Shippo key configured (Settings → Warehouses) — nothing to do.');
  return;
}

// Same population and throttle as the old in-app listTrackableShipments.
// Least-recently-polled first so a backlog beyond LIMIT can't starve the
// tail (ORDER BY id would re-poll the same lowest ids every run).
const ships = await sql`
  SELECT so2.id, so2.sales_order_id, so2.carrier, so2.tracking_number, so2.tracking_status
  FROM shipments_outbound so2
  WHERE so2.status = 'in_transit'
    AND so2.tracking_number IS NOT NULL
    AND so2.carrier IN ('USPS', 'UPS', 'FedEx', 'DHL')
    AND (so2.tracking_checked_at IS NULL OR so2.tracking_checked_at < NOW() - INTERVAL '25 minutes')
    AND (so2.tracking_status IS NULL OR so2.tracking_status NOT IN ('RETURNED', 'FAILURE'))
  ORDER BY so2.tracking_checked_at ASC NULLS FIRST, so2.id
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
      // row isn't permanently due. Mirrors the old updateShipmentTracking:
      // RETURNED auto-raises the returned_to_sender issue flag so the
      // shipment surfaces on the dashboard instead of silently dropping
      // out of the poll population.
      const st = status ?? s.tracking_status ?? null;
      await sql`
        UPDATE shipments_outbound SET
          tracking_status = ${st},
          tracking_checked_at = NOW(),
          issue_flag = CASE
            WHEN ${st} = 'RETURNED' AND issue_flag IS NULL THEN 'returned_to_sender'
            ELSE issue_flag
          END,
          issue_flagged_at = CASE
            WHEN ${st} = 'RETURNED' AND issue_flag IS NULL THEN NOW()
            ELSE issue_flagged_at
          END
        WHERE id = ${s.id}`;
      updated++;
      if (status) console.log(`  shipment ${s.id} (${s.carrier} ${num}): ${status}`);
    }
  } catch (e) {
    failed++;
    console.error(`  shipment ${s.id}: DB update failed — ${e instanceof Error ? e.message : e}`);
  }
}

// ---- Inbound (logistics) shipments -----------------------------------
// Same Shippo /tracks polling for factory shipments. shipments_inbound has
// no carrier field historically, so the carrier is auto-detected from the
// tracking number's format and stored on first detection; numbers that
// match no known format are skipped (never polled, never stamped, so they
// stay visible as "no tracking data" rather than silently consumed).

function detectCarrier(num: string): string | null {
  const n = num.replace(/\s+/g, '');
  if (/^1Z/i.test(n)) return 'UPS';
  if (/^9\d{21,25}$/.test(n)) return 'USPS';
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return 'FedEx';
  if (/^\d{10}$/.test(n)) return 'DHL';
  return null;
}

type InboundRow = {
  id: number; reference_number: string; carrier: string | null;
  tracking_number: string; tracking_status: string | null;
};

// The trackable-format predicate lives in SQL so untrackable numbers
// (ocean freight refs etc., which never get stamped) can't occupy the
// LIMIT slots forever and starve real polls behind them. The regexes
// mirror detectCarrier, with the stored leading '#' tolerated.
const inbound = await sql`
  SELECT si.id, si.reference_number, si.carrier, si.tracking_number, si.tracking_status
  FROM shipments_inbound si
  WHERE si.status IN ('freight_forwarder', 'in_transit')
    AND COALESCE(si.tracking_number, '') <> ''
    AND (si.carrier IN ('USPS', 'UPS', 'FedEx', 'DHL')
      OR si.tracking_number ~* '^#?1Z'
      OR si.tracking_number ~ '^#?9[0-9]{21,25}$'
      OR si.tracking_number ~ '^#?([0-9]{12}|[0-9]{15}|[0-9]{10})$')
    AND (si.tracking_checked_at IS NULL OR si.tracking_checked_at < NOW() - INTERVAL '25 minutes')
  ORDER BY si.tracking_checked_at ASC NULLS FIRST, si.id
  LIMIT 50` as InboundRow[];

const untrackable = await sql`
  SELECT COUNT(*)::int AS n
  FROM shipments_inbound si
  WHERE si.status IN ('freight_forwarder', 'in_transit')
    AND COALESCE(si.tracking_number, '') <> ''
    AND si.carrier IS NULL
    AND NOT (si.tracking_number ~* '^#?1Z'
      OR si.tracking_number ~ '^#?9[0-9]{21,25}$'
      OR si.tracking_number ~ '^#?([0-9]{12}|[0-9]{15}|[0-9]{10})$')` as { n: number }[];

console.log(`${inbound.length} inbound shipment(s) due for a tracking poll` +
  (untrackable[0]?.n ? ` (${untrackable[0].n} with unrecognized number formats left untracked)` : '') + '.');
let inDelivered = 0, inUpdated = 0, inSkipped = 0, inFailed = 0;

for (const s of inbound) {
  const num = String(s.tracking_number).replace(/^#/, '').trim();
  const carrier = s.carrier || detectCarrier(num);
  const token = carrier ? CARRIER_TOKENS[carrier] : null;
  if (!token) {
    inSkipped++;
    continue;
  }

  let status: string | null = null;
  let statusDate: string | null = null;
  let details: string | null = null;
  let eta: string | null = null;
  try {
    const res = await fetch(`https://api.goshippo.com/tracks/${token}/${encodeURIComponent(num)}`, {
      headers: { Authorization: `ShippoToken ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json() as {
        eta?: string | null;
        tracking_status?: { status?: string; status_date?: string; status_details?: string } | null;
      };
      status = data?.tracking_status?.status || null;
      statusDate = data?.tracking_status?.status_date || null;
      details = data?.tracking_status?.status_details || null;
      eta = data?.eta || null;
    } else {
      console.error(`  inbound ${s.id} (${s.reference_number}, ${carrier} ${num}): HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`  inbound ${s.id} (${s.reference_number}, ${carrier} ${num}): ${e instanceof Error ? e.message : e}`);
  }

  try {
    if (status === 'DELIVERED') {
      // Carrier delivery stamps tracking + arrival, but the APP status
      // only flips to 'delivered' once every line has been received —
      // the same guard the manual updateShipmentStatus enforces. A
      // delivered app status removes the shipment from the warehouse
      // In-Transit receive tab, so flipping early would orphan the
      // receiving flow; until then the UI shows carrier status
      // "Delivered" against app status "In Transit" (= arrived, not
      // yet received).
      await sql`
        UPDATE shipments_inbound SET
          status = CASE WHEN NOT EXISTS (
              SELECT 1 FROM shipments_inbound_items sii
              WHERE sii.shipment_id = shipments_inbound.id AND sii.quantity_received IS NULL
            ) THEN 'delivered' ELSE status END,
          arrival_date = COALESCE(arrival_date, ${statusDate ? statusDate.slice(0, 10) : null}::date, CURRENT_DATE),
          carrier = COALESCE(carrier, ${carrier}),
          tracking_status = 'DELIVERED',
          tracking_details = ${details},
          tracking_eta = ${eta}::timestamptz,
          tracking_checked_at = NOW()
        WHERE id = ${s.id} AND status IN ('freight_forwarder', 'in_transit')`;
      inDelivered++;
      console.log(`  inbound ${s.id} (${s.reference_number}, ${carrier} ${num}): DELIVERED (carrier)`);
    } else {
      // Stamp the poll time even when Shippo had nothing usable, so the
      // row isn't permanently due. Keep the last known status when this
      // poll returned none, but refresh details/ETA only from real data.
      const st = status ?? s.tracking_status ?? null;
      await sql`
        UPDATE shipments_inbound SET
          carrier = COALESCE(carrier, ${carrier}),
          tracking_status = ${st},
          tracking_details = COALESCE(${details}, tracking_details),
          tracking_eta = COALESCE(${eta}::timestamptz, tracking_eta),
          tracking_checked_at = NOW()
        WHERE id = ${s.id}`;
      inUpdated++;
      if (status) console.log(`  inbound ${s.id} (${s.reference_number}, ${carrier} ${num}): ${status}${eta ? ` (ETA ${eta.slice(0, 10)})` : ''}`);
    }
  } catch (e) {
    inFailed++;
    console.error(`  inbound ${s.id}: DB update failed — ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`Inbound: ${inDelivered} delivered, ${inUpdated} status-stamped, ${inSkipped} skipped (unrecognized number format), ${inFailed} failed.`);

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
}

try {
  await main();
} finally {
  await sql.end();
}
