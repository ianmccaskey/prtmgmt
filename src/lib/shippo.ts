/**
 * Client-side Shippo API integration. api.goshippo.com serves
 * `Access-Control-Allow-Origin: *`, so the browser can call it directly with
 * the warehouse's own API key — no proxy needed.
 */

const BASE = 'https://api.goshippo.com';

export type ShippoAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  zip: string;
  country: string;
  phone?: string;
  /** Some carriers (USPS Ground Advantage) refuse labels without a sender email. */
  email?: string;
};

export type ShippoParcel = {
  length: string;
  width: string;
  height: string;
  distance_unit: 'in';
  weight: string;
  mass_unit: 'lb';
};

export type ShippoRate = {
  object_id: string;
  provider: string;
  servicelevel: { name: string; token: string };
  amount: string;
  currency: string;
  estimated_days: number | null;
  duration_terms: string | null;
};

export type ShippoLabel = {
  object_id: string;
  tracking_number: string;
  label_url: string;
  tracking_url_provider: string | null;
};

type ShippoMessage = { text?: string; source?: string };

function collectMessages(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as { detail?: unknown; messages?: ShippoMessage[] };
  const out: string[] = [];
  if (typeof d.detail === 'string') out.push(d.detail);
  if (Array.isArray(d.messages)) {
    for (const m of d.messages) if (m && typeof m.text === 'string') out.push(m.text);
  }
  return [...new Set(out)];
}

/**
 * Field-level validation errors come back as { field: ["msg", ...] }. Only
 * scan error responses — success payloads legitimately contain string arrays
 * (e.g. carrier_accounts) that aren't messages.
 */
function collectFieldErrors(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (k === 'messages' || k === 'detail') continue;
    if (Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string')) {
      out.push(`${k}: ${(v as string[]).join(' ')}`);
    }
  }
  return out;
}

/**
 * Per-carrier chatter Shippo emits on every successful quote (accounts that
 * simply returned no rate, boilerplate reference-rate alerts). Hidden when
 * rates exist; when nothing quoted these ARE the explanation, so keep them.
 */
const NOISE_PATTERNS = [
  /carrier account .+ (doesn'?t|does not) support/i,
  /master account (doesn'?t|does not) support/i,
  /out of (the )?service area/i,
  /RatedShipmentAlert: Your invoice may vary/i,
  /RatedShipmentAlert: Modifier is applied/i,
];

/**
 * Opt-in request logging. Run `localStorage.setItem('prt:shippo-debug', '1')`
 * in the browser console (remove the key to turn it back off) to have every
 * Shippo exchange pretty-printed to the console — including the messages the
 * rate UI hides via NOISE_PATTERNS. Per-browser and survives reloads.
 *
 * Names, street lines, phone and email are masked by default: a console log
 * outlives the debugging session in DevTools history, screen shares and
 * screenshots, and these are real customer addresses. Masked values keep the
 * character count so you can still tell 'missing' from 'malformed'. Set
 * 'prt:shippo-debug-pii' to '1' as well when you genuinely need the literal
 * address Shippo received. The Authorization header carries the live API key
 * and is never logged under either flag.
 */
const DEBUG_KEY = 'prt:shippo-debug';
const DEBUG_PII_KEY = 'prt:shippo-debug-pii';

/** Address fields that identify a person rather than a destination. */
const PII_FIELDS = new Set([
  'name', 'company', 'street1', 'street2', 'street3', 'phone', 'email',
  'object_owner', // Shippo echoes the account holder's email on every object
]);

function flagOn(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Deep-copy a payload with PII_FIELDS masked. Empty/absent values pass through so gaps stay visible. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_FIELDS.has(k) && typeof v === 'string' && v.length > 0
        ? `‹redacted ${v.length} chars›`
        : redact(v);
    }
    return out;
  }
  return value;
}

function logExchange(path: string, body: unknown, status: number | null, data: unknown, startedAt: number) {
  if (!flagOn(DEBUG_KEY)) return;
  // Everything that can throw (redact, stringify) runs before the first console
  // call, and the whole helper is fail-closed: debug logging must never be the
  // reason a rate quote or a label purchase fails.
  try {
    const pii = flagOn(DEBUG_PII_KEY);
    const ms = Math.round(performance.now() - startedAt);
    const label = `[shippo] POST ${path} → ${status ?? 'network error'} (${ms}ms)${pii ? ' [unmasked]' : ''}`;
    const req = JSON.stringify(pii ? body : redact(body), null, 2);
    const res = pii ? data : redact(data);
    console.groupCollapsed(label);
    try {
      console.log('request', req);
      console.log('response', res);
    } finally {
      console.groupEnd();
    }
  } catch {
    /* a broken log line is never worth breaking the shipment over */
  }
}

async function post(apiKey: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const startedAt = performance.now();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: { Authorization: `ShippoToken ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    logExchange(path, body, null, null, startedAt);
    throw new Error('Could not reach Shippo — check your network connection.');
  }
  const data = await res.json().catch(() => null);
  logExchange(path, body, res.status, data, startedAt);
  if (!res.ok) {
    const msgs = [...collectMessages(data), ...collectFieldErrors(data)];
    throw new Error(msgs.length ? msgs.join(' · ') : `Shippo request failed (HTTP ${res.status}).`);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/** Create a Shippo shipment and return its rates (cheapest first) plus any address/validation warnings. */
export async function getShippoRates(
  apiKey: string, from: ShippoAddress, to: ShippoAddress, parcel: ShippoParcel,
): Promise<{ rates: ShippoRate[]; messages: string[] }> {
  const shipment = await post(apiKey, '/shipments/', {
    address_from: from,
    address_to: to,
    parcels: [parcel],
    async: false,
  });
  const rates = (Array.isArray(shipment.rates) ? shipment.rates as ShippoRate[] : [])
    .slice()
    .sort((a, b) => Number(a.amount) - Number(b.amount));
  let messages = collectMessages(shipment);
  if (rates.length > 0) messages = messages.filter(m => !NOISE_PATTERNS.some(p => p.test(m)));
  return { rates, messages };
}

/** Purchase a label for a previously quoted rate. Throws with Shippo's reasons on failure. */
export async function buyShippoLabel(apiKey: string, rateObjectId: string): Promise<ShippoLabel> {
  const tx = await post(apiKey, '/transactions/', {
    rate: rateObjectId,
    label_file_type: 'PDF_4x6',
    async: false,
  });
  if (tx.status !== 'SUCCESS') {
    const msgs = collectMessages(tx);
    throw new Error(msgs.length ? msgs.join(' · ') : `Label purchase ${String(tx.status || 'failed').toLowerCase()}.`);
  }
  return tx as unknown as ShippoLabel;
}

export type ShippoTracking = {
  /** Shippo tracking statuses: PRE_TRANSIT, TRANSIT, DELIVERED, RETURNED, FAILURE, UNKNOWN */
  status: string;
  statusDate: string | null;
  statusDetails: string | null;
};

/** Map our carrier CHECK values onto Shippo tracking carrier tokens. null = not trackable. */
export function trackingCarrierToken(carrier: string | null | undefined): string | null {
  switch (carrier) {
    case 'USPS': return 'usps';
    case 'UPS': return 'ups';
    case 'FedEx': return 'fedex';
    case 'DHL': return 'dhl_express';
    default: return null;
  }
}

/**
 * Fetch tracking for one shipment. Tracking is account-agnostic on Shippo's
 * side — any valid API key can track any carrier/number — so the app uses a
 * single designated key for this regardless of which warehouse shipped.
 * Returns null when the carrier isn't trackable or Shippo has no data yet.
 */
export async function getShippoTracking(
  apiKey: string, carrier: string | null | undefined, trackingNumber: string,
): Promise<ShippoTracking | null> {
  const token = trackingCarrierToken(carrier);
  if (!token || !trackingNumber.trim()) return null;
  let res: Response;
  try {
    res = await fetch(`${BASE}/tracks/${token}/${encodeURIComponent(trackingNumber.trim())}`, {
      headers: { Authorization: `ShippoToken ${apiKey}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as {
    tracking_status?: { status?: string; status_date?: string; status_details?: string } | null;
  } | null;
  const ts = data?.tracking_status;
  if (!ts || !ts.status) return null;
  return {
    status: ts.status,
    statusDate: ts.status_date || null,
    statusDetails: ts.status_details || null,
  };
}

/**
 * Public carrier tracking page for a shipment — lets the UI render tracking
 * numbers as click-to-track links. null when the carrier has no page we
 * know ('other') or there's no number.
 */
export function carrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const num = (trackingNumber || '').trim();
  if (!num) return null;
  const n = encodeURIComponent(num);
  switch (carrier) {
    case 'USPS': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case 'UPS': return `https://www.ups.com/track?tracknum=${n}`;
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case 'DHL': return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;
    default: return null;
  }
}

/** Map a Shippo provider name onto the shipments_outbound.carrier CHECK values. */
export function providerToCarrier(provider: string): 'USPS' | 'UPS' | 'FedEx' | 'DHL' | 'other' {
  const p = provider.toLowerCase();
  if (p.includes('usps')) return 'USPS';
  if (p.includes('ups')) return 'UPS';
  if (p.includes('fedex')) return 'FedEx';
  if (p.includes('dhl')) return 'DHL';
  return 'other';
}

/** Normalize the free-text country field to the ISO-2 code Shippo expects (common cases only). */
export function toIsoCountry(raw: string | null | undefined): string {
  const c = (raw || '').trim();
  if (!c) return 'US';
  const l = c.toLowerCase();
  if (['us', 'usa', 'united states', 'united states of america'].includes(l)) return 'US';
  if (['ca', 'canada'].includes(l)) return 'CA';
  return c.length === 2 ? c.toUpperCase() : c;
}
