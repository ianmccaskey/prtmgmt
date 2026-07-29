/**
 * Heuristic parser for customer-pasted contact blobs, e.g.:
 *
 *   Mike Benavidez
 *   4212 Jamie Trl
 *   Amarillo,Tx
 *   79110
 *
 * Returns only the fields it confidently found — callers merge over the
 * form without clearing anything the parser didn't identify. US-centric
 * (matches the app's US-only warehouse shipping).
 */

export type ParsedCustomer = {
  full_name?: string;
  email?: string;
  phone?: string;
  ship_address_line1?: string;
  ship_address_line2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_postal_code?: string;
};

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR',
]);

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// 10-digit US phone (optionally +1), separators optional — anchored on
// BOTH sides so a ZIP+4, house number, or the tail of a longer digit run
// (tracking number) never half-matches.
const PHONE_RE = /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
const STREET_RE = /^\d+\s+\S|^p\.?\s?o\.?\s*box/i;
const UNIT_RE = /^(apt|apartment|unit|suite|ste|bldg|building|lot|trlr|trailer|fl|floor|rm|room|#)\b/i;

/** Try to pull "City, ST" / "City ST" / "City, Texas" out of one line (zip already stripped). */
function cityState(line: string): { city?: string; state?: string } | null {
  const cleaned = line.replace(/[,\s]+$/, '').trim();
  if (!cleaned) return null;
  // Trailing 2-letter state code, comma or space separated ("Amarillo,Tx", "Amarillo TX")
  const m = cleaned.match(/^(.*?)[,\s]+([A-Za-z]{2})\.?$/);
  if (m && US_STATES.has(m[2].toUpperCase())) {
    return { city: m[1].replace(/,+$/, '').trim() || undefined, state: m[2].toUpperCase() };
  }
  // Trailing full state name ("Amarillo, Texas")
  const lower = cleaned.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lower.endsWith(name)) {
      const city = cleaned.slice(0, cleaned.length - name.length).replace(/[,\s]+$/, '').trim();
      return { city: city || undefined, state: code };
    }
  }
  // Whole line is just a state
  if (US_STATES.has(cleaned.toUpperCase())) return { state: cleaned.toUpperCase() };
  if (STATE_NAMES[lower]) return { state: STATE_NAMES[lower] };
  return null;
}

export function parseCustomerPaste(text: string): ParsedCustomer {
  const out: ParsedCustomer = {};
  let work = text;

  const email = work.match(EMAIL_RE);
  if (email) { out.email = email[0]; work = work.replace(email[0], ' '); }
  const phone = work.match(PHONE_RE);
  if (phone) { out.phone = phone[0].trim(); work = work.replace(phone[0], ' '); }

  let lines = work.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ZIP: last occurrence wins (it trails the address); strip it from its line.
  for (let i = lines.length - 1; i >= 0; i--) {
    const z = lines[i].match(ZIP_RE);
    if (z) {
      out.ship_postal_code = z[0];
      lines[i] = lines[i].replace(z[0], '').trim();
      break;
    }
  }
  lines = lines.filter(Boolean);

  // City/state: scan from the bottom (they follow the street lines).
  let cityIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (STREET_RE.test(lines[i])) continue; // never mistake "4212 Jamie Trl" for a city
    const cs = cityState(lines[i]);
    if (cs && cs.state) {
      if (cs.city) out.ship_city = cs.city;
      out.ship_state = cs.state;
      cityIdx = i;
      // State-only line: the city is likely the previous non-street line.
      if (!cs.city && i > 0 && !STREET_RE.test(lines[i - 1]) && !/\d/.test(lines[i - 1])) {
        out.ship_city = lines[i - 1];
        cityIdx = i - 1;
      }
      break;
    }
  }

  // Street: first line that looks like one, before the city line.
  const limit = cityIdx >= 0 ? cityIdx : lines.length;
  let streetIdx = -1;
  for (let i = 0; i < limit; i++) {
    if (STREET_RE.test(lines[i])) { streetIdx = i; out.ship_address_line1 = lines[i].replace(/,+$/, ''); break; }
  }
  // Line 2: the line between street and city (when a city line was found),
  // or an explicit unit/suite line right after the street otherwise.
  if (streetIdx >= 0 && streetIdx + 1 < limit) {
    const next = lines[streetIdx + 1];
    if (cityIdx > streetIdx + 1 || UNIT_RE.test(next)) {
      out.ship_address_line2 = next.replace(/,+$/, '');
    }
  }

  // Name: first line with no digits that isn't the street/city/state.
  for (let i = 0; i < lines.length; i++) {
    if (i === streetIdx || i === cityIdx) continue;
    if (out.ship_address_line2 && lines[i] === out.ship_address_line2) continue;
    const l = lines[i];
    if (!/\d/.test(l) && !cityState(l) && l.length >= 3) {
      out.full_name = l.replace(/,+$/, '').trim();
      break;
    }
  }

  return out;
}
