/**
 * Accumark Labs COA sync.
 *
 * Pulls the account's COAs from the Accumark client API and records them as
 * batch_tests rows on the matching product batch, so lab results flow into
 * the app's QC rollup and the public pricesheet's COA links automatically.
 *
 * Matching: Accumark's `lot_code` ↔ our product_batches.batch_number
 * (case- and whitespace-insensitive). Put the batch number on the sample
 * submission and the sync does the rest; unmatched lot codes are listed in
 * the log each run.
 *
 * API notes (derived from Accumark's own AccuVerify plugin source):
 *  - Authenticated list:  GET /client/coas  with `Authorization: Bearer <key>`.
 *    Their host's page cache does NOT vary on the Authorization header, so
 *    every authenticated call appends a `_cb` cache-buster (their plugin
 *    does the same; unknown params are ignored server-side).
 *  - Per-code details:    GET /badge/{code} — public, no auth, includes
 *    lot_code, dates, overall_status, and the per-analyte result arrays.
 *  - Human report:        https://accumarklabs.com/verify/{code} — stored as
 *    the test_report_url so the app/pricesheet link straight to the live COA.
 *
 * The API key comes from app_settings.accumark_api_key (Settings → Wallets &
 * Config → Accumark Labs API Key) or the ACCUMARK_API_KEY env var. No key =
 * clean exit, nothing to do.
 *
 * Invoked by .github/workflows/accumark-sync.yml (cron-job.org drives the
 * real cadence; needs the DATABASE_URL repo secret), or locally:
 *
 *   bun tools/sync-accumark.ts            # real run
 *   bun tools/sync-accumark.ts --dry-run  # print planned inserts, write nothing
 */
import { SQL } from 'bun';

const DRY_RUN = process.argv.includes('--dry-run');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (env or .env.local at the repo root).');
  process.exit(1);
}
const sql = new SQL(url);

const API_BASE = 'https://accumarklabs.com/wp-json/accumark/v1';
const VERIFY_BASE = 'https://accumarklabs.com/verify/';
const LAB_NAME = 'Accumark Labs';

/** Normalize a lot/batch code for matching: trim, uppercase, drop spaces. */
function normLot(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

type PlannedTest = {
  batch_id: number;
  test_type: 'hplc_purity' | 'mass_spec' | 'endotoxin' | 'sterility' | 'other';
  test_date: string | null;
  result_value: number | null;
  result_units: string | null;
  pass_fail: 'pass' | 'fail' | 'marginal' | null;
  test_report_url: string;
  notes: string;
};

/** Map a status-ish string onto the batch_tests pass_fail CHECK values. */
function mapPassFail(s: unknown): 'pass' | 'fail' | 'marginal' | null {
  const t = String(s ?? '').toLowerCase();
  if (!t) return null;
  if (/fail|reject/.test(t)) return 'fail';
  if (/pass|verified|ok|success/.test(t)) return 'pass';
  return 'marginal';
}

/**
 * Parse a lab value STRICTLY: the whole string must be a number with at
 * most a comparator prefix (< > ≤ ≥ ~) and a short unit suffix. Prose that
 * merely contains a number, scientific notation ('1e9' would silently
 * become 1), and anything else parse to null — a missing value is honest,
 * a wrong lab value in the QC record is not. NUMERIC(12,4) bounds are
 * enforced here too so one bad value can't fail the whole COA insert.
 */
function parseLabValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && Math.abs(raw) < 1e8 ? raw : null;
  if (raw == null) return null;
  const m = String(raw).match(/^\s*[<>≤≥~]?\s*(-?\d+(?:[.,]\d+)?)\s*(?:%|[a-zA-Zµμ][a-zA-Zµμ/%-]{0,9})?\s*$/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && Math.abs(v) < 1e8 ? v : null;
}

/**
 * Pull name/value/units/status out of one analyte entry, whatever its exact
 * key spelling. The badge payload's field names inside the result arrays
 * aren't publicly documented, so this reads the first matching key of each
 * kind and the --dry-run output is the place to eyeball real data. All
 * strings are length-capped: this is external data headed for our DB.
 */
function readAnalyte(entry: Record<string, unknown>) {
  const pick = (keys: string[]) => {
    for (const k of keys) if (entry[k] != null && entry[k] !== '') return entry[k];
    return null;
  };
  const name = String(pick(['name', 'label', 'test', 'test_name', 'analyte', 'title', 'type']) ?? '').slice(0, 80);
  const rawValue = pick(['value', 'result', 'result_value', 'measured', 'amount', 'purity', 'quantity']);
  const value = parseLabValue(rawValue);
  const unitsRaw = pick(['units', 'unit', 'uom']);
  const units = unitsRaw == null ? null : String(unitsRaw).slice(0, 16);
  const status = pick(['status', 'pass_fail', 'result_status', 'outcome', 'grade']);
  return { name, value, units, status, rawValue };
}

/** Classify an analyte name onto our batch_tests test_type CHECK values. */
function classify(name: string): { type: PlannedTest['test_type']; units: string | null; note: string } {
  if (/purity/i.test(name)) return { type: 'hplc_purity', units: '%', note: 'HPLC purity' };
  if (/endotoxin|\bLAL\b/i.test(name)) return { type: 'endotoxin', units: 'EU/mg', note: 'Endotoxin (LAL)' };
  if (/steril/i.test(name)) return { type: 'sterility', units: null, note: 'Sterility' };
  if (/quantity|content|net\s*mass|\bmg\b/i.test(name)) return { type: 'other', units: 'mg', note: 'Quantity verification' };
  if (/identity/i.test(name)) return { type: 'other', units: null, note: 'Identity confirmation' };
  return { type: 'other', units: null, note: name || 'Accumark result' };
}

async function fetchJson(path: string, apiKey?: string): Promise<unknown> {
  // Cache-buster on authenticated calls (see header comment); the public
  // badge endpoint stays cacheable without one.
  const cb = apiKey ? `${path.includes('?') ? '&' : '?'}_cb=${crypto.randomUUID().slice(0, 16)}` : '';
  const res = await fetch(`${API_BASE}${path}${cb}`, {
    headers: {
      Accept: 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

async function main() {
  const keyRows = await sql`
    SELECT value FROM app_settings WHERE key = 'accumark_api_key' AND COALESCE(value, '') <> ''` as { value: string }[];
  const apiKey = keyRows[0]?.value || process.env.ACCUMARK_API_KEY || '';
  if (!apiKey) {
    console.log('No Accumark API key configured (Settings → Wallets & Config, or ACCUMARK_API_KEY) — nothing to do.');
    return;
  }

  // Our batches, once, for lot matching.
  const batches = await sql`
    SELECT pb.id, pb.batch_number FROM product_batches pb` as { id: number; batch_number: string }[];
  const byLot = new Map<string, number>();
  for (const b of batches) byLot.set(normLot(b.batch_number), Number(b.id));

  // Codes already recorded — dedupe on the verify URL, which embeds the code.
  const existing = await sql`
    SELECT DISTINCT test_report_url FROM batch_tests
    WHERE test_report_url LIKE ${VERIFY_BASE + '%'}` as { test_report_url: string }[];
  const knownUrls = new Set(existing.map(r => r.test_report_url));

  // Page through the account's COAs.
  type CoaItem = Record<string, unknown>;
  const items: CoaItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const body = await fetchJson(`/client/coas?per_page=100&page=${page}&with_summary=1`, apiKey) as
      { items?: CoaItem[]; total_pages?: number } | CoaItem[];
    const chunk = Array.isArray(body) ? body : (body.items ?? []);
    items.push(...chunk);
    const totalPages = Array.isArray(body) ? 1 : Number(body.total_pages ?? 1);
    if (page >= totalPages || chunk.length === 0) break;
  }
  console.log(`${items.length} COA(s) on the Accumark account.`);
  if (DRY_RUN && items.length > 0) {
    console.log('First COA list item (dry-run shape check):', JSON.stringify(items[0]).slice(0, 800));
  }

  let inserted = 0, skippedKnown = 0, failedCount = 0, newFetched = 0;
  const unmatched: string[] = [];
  const touchedBatches = new Set<number>();
  // Per-run cap on NEW codes: a huge first backlog spreads over several
  // runs instead of racing the workflow's 10-minute timeout.
  const MAX_NEW_PER_RUN = 300;

  for (const item of items) {
    const code = String(item.code ?? item.verification_code ?? item.sample_code ?? '').toUpperCase();
    // Accumark's own badge route only accepts [A-Z0-9-]+ — anything else in
    // a list response is malformed or hostile; never build a URL from it.
    if (!code) continue;
    if (!/^[A-Z0-9-]{1,80}$/.test(code)) {
      console.warn(`  skipping malformed code ${JSON.stringify(code.slice(0, 60))}`);
      continue;
    }
    const reportUrl = VERIFY_BASE + code;
    if (knownUrls.has(reportUrl)) { skippedKnown++; continue; }
    if (newFetched >= MAX_NEW_PER_RUN) break;
    newFetched++;

    // Full details from the public badge endpoint — one authoritative shape
    // for lot, dates, status, and the per-analyte arrays.
    let badge: Record<string, unknown>;
    try {
      badge = await fetchJson(`/badge/${encodeURIComponent(code)}`) as Record<string, unknown>;
    } catch (e) {
      failedCount++;
      console.error(`  ${code}: badge fetch failed — ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const lot = String(badge.lot_code ?? item.lot_code ?? '').trim();
    const batchId = lot ? byLot.get(normLot(lot)) : undefined;
    if (!batchId) {
      if (lot) unmatched.push(`${code} (lot "${lot}")`);
      else unmatched.push(`${code} (no lot code)`);
      continue;
    }

    const sampleName = String(badge.sample_name ?? badge.product_name ?? '').slice(0, 120);
    const testDateRaw = String(badge.date_completed ?? '').slice(0, 10);
    const testDate = /^\d{4}-\d{2}-\d{2}$/.test(testDateRaw) ? testDateRaw : null;
    const overall = mapPassFail(badge.overall_status);

    // Collect analytes across whichever result arrays this report carries.
    const analyteArrays = ['core_panel_results', 'analyte_results', 'addon_results', 'test_results']
      .map(k => badge[k])
      .filter((v): v is Record<string, unknown>[] => Array.isArray(v));
    const planned: PlannedTest[] = [];
    for (const arr of analyteArrays) {
      for (const raw of arr) {
        const a = readAnalyte(raw);
        if (!a.name && a.value == null) continue;
        const cls = classify(a.name);
        // Purity is a percentage by definition — a value outside [0,100]
        // is a misparse, and null is more honest than a wrong number.
        const value = cls.type === 'hplc_purity' && a.value != null && (a.value < 0 || a.value > 100)
          ? null : a.value;
        planned.push({
          batch_id: batchId,
          test_type: cls.type,
          test_date: testDate,
          result_value: value,
          result_units: a.units || cls.units,
          pass_fail: mapPassFail(a.status) ?? overall,
          test_report_url: reportUrl,
          notes: `${cls.note}${a.name && a.name !== cls.note ? ` (${a.name})` : ''} — Accumark ${code}${sampleName ? `, sample: ${sampleName}` : ''}`.slice(0, 300),
        });
      }
    }
    // No parseable analytes: still record the COA link so the batch carries
    // the report, and flag it for a mapping look.
    if (planned.length === 0) {
      console.warn(`  ${code}: no analyte arrays parsed — recording link-only row (check payload shape).`);
      planned.push({
        batch_id: batchId,
        test_type: 'other',
        test_date: testDate,
        result_value: null,
        result_units: null,
        pass_fail: overall,
        test_report_url: reportUrl,
        notes: `Accumark COA ${code}${sampleName ? `, sample: ${sampleName}` : ''} (link-only — analyte parse failed)`,
      });
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] ${code} → batch ${batchId} (${lot}): ${planned.length} row(s)`);
      for (const p of planned) console.log(`      ${p.test_type} ${p.result_value ?? '—'}${p.result_units ?? ''} ${p.pass_fail ?? ''} — ${p.notes}`);
      inserted += planned.length;
      continue;
    }

    try {
      // ONE statement per COA (the repo's no-transactions atomicity rule):
      // either every row of this report lands or none do. A partial insert
      // would be frozen forever by the per-code dedupe on the next run.
      const rows = await sql`
        INSERT INTO batch_tests (batch_id, test_type, test_date, lab_name, result_value, result_units, pass_fail, test_report_url, notes)
        SELECT t.batch_id, t.test_type, NULLIF(t.test_date, '')::date, ${LAB_NAME},
               t.result_value, t.result_units, t.pass_fail, t.test_report_url, t.notes
        FROM jsonb_to_recordset(${JSON.stringify(planned)}::jsonb)
          AS t(batch_id bigint, test_type text, test_date text, result_value numeric,
               result_units text, pass_fail text, test_report_url text, notes text)
        RETURNING id` as { id: number }[];
      inserted += rows.length;
      touchedBatches.add(batchId);
      knownUrls.add(reportUrl);
      console.log(`  ${code} → batch ${batchId} (${lot}): ${rows.length} test row(s) recorded.`);
    } catch (e) {
      failedCount++;
      console.error(`  ${code}: DB insert failed — ${e instanceof Error ? e.message : e}`);
    }
  }

  // QC rollup for every batch that gained tests — same derivation as the
  // in-app rollupBatchQc action (manual quarantine always wins; newest
  // hplc_purity + mass_spec must both pass; purity denormalized).
  for (const batchId of touchedBatches) {
    await sql`
      WITH latest AS (
        SELECT
          (SELECT pass_fail FROM batch_tests
            WHERE batch_id = ${batchId} AND test_type = 'hplc_purity'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS hplc_pf,
          (SELECT result_value FROM batch_tests
            WHERE batch_id = ${batchId} AND test_type = 'hplc_purity'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS hplc_value,
          (SELECT pass_fail FROM batch_tests
            WHERE batch_id = ${batchId} AND test_type = 'mass_spec'
            ORDER BY test_date DESC NULLS LAST, id DESC LIMIT 1) AS ms_pf
      )
      UPDATE product_batches pb
      SET qc_status = CASE
            WHEN pb.qc_status = 'quarantine' THEN pb.qc_status
            WHEN latest.hplc_pf = 'fail' OR latest.ms_pf = 'fail' THEN 'failed'
            WHEN latest.hplc_pf = 'pass' AND latest.ms_pf = 'pass' THEN 'passed'
            ELSE 'pending'
          END,
          overall_purity_pct = COALESCE(latest.hplc_value, pb.overall_purity_pct)
      FROM latest
      WHERE pb.id = ${batchId}`;
  }

  if (unmatched.length > 0) {
    console.log(`Unmatched COAs (lot code has no batch — put the batch number on the sample submission):`);
    for (const u of unmatched) console.log(`  ${u}`);
  }
  console.log(`Done${DRY_RUN ? ' (dry-run, nothing written)' : ''}: ${inserted} test row(s) ${DRY_RUN ? 'planned' : 'inserted'}, ${skippedKnown} COA(s) already recorded, ${unmatched.length} unmatched, ${failedCount} failed, ${touchedBatches.size} batch(es) QC-rolled.`);
}

try {
  await main();
} finally {
  await sql.end();
}
