/**
 * Regenerates the public price sheet (github.com/PRTLabs/pricesheet) from
 * the Peptide Ops database and pushes it — prices with quantity tiers,
 * stock status, COA links, and promo badges, all driven by the app.
 *
 * The sheet is a self-extracting Claude Design canvas export: one
 * index.html whose real page lives in a `__bundler/template` JSON blob
 * containing an x-dc markup section and a dc-script with a hardcoded
 * product data array. This tool owns the ENTIRE dc-script (template
 * string below) and regenerates it with fresh rows; the markup and font
 * assets are never touched.
 *
 * Data rules (mirrors the app):
 * - Products: show_on_pricelist AND is_active, ordered by pricelist_sort
 *   then group; group/spec default from name ("Tirzepatide 60" →
 *   "TIRZEPATIDE") when the explicit fields are blank.
 * - Prices: effective unit price at qty 1 / 2 / 20 — best price tier
 *   with min_quantity <= qty, else list_price (same rule the New Order
 *   form applies), matching the sheet's 1 kit / 2+ kits / 20+ kits columns.
 * - Status: pricelist_status_override wins unless 'auto'; auto derives
 *   AVAILABLE from sellable stock (QC-passed batches, active warehouses,
 *   on_hand − reserved), IN TRANSIT from undelivered inbound shipment
 *   quantity, else OUT OF STOCK.
 * - COA: from the newest QC-passed batch that has any certificate link.
 *   Within that batch, passing test reports are grouped by link (tests
 *   with no report URL of their own belong to the batch's coa_url) and
 *   scored by mass-spec content, purity as tiebreak — the best-scoring
 *   report supersedes the others (Ian's rule: publish the strongest
 *   certificate). The batch number is shown beside the link.
 *
 * Publishes ONLY when the regenerated file differs (quiet no-op runs, so
 * a frequent schedule approximates sync-on-change without churn).
 *
 * Setup: DATABASE_URL in the environment (or .env.local at the repo
 * root). Local runs push with your ambient git credentials; CI passes
 * PRICESHEET_TOKEN (fine-grained PAT, Contents read/write on
 * PRTLabs/pricesheet) instead.
 *
 * Usage (from the repo root):
 *   bun tools/sync-pricesheet.ts             # regenerate + push if changed
 *   bun tools/sync-pricesheet.ts --dry-run   # regenerate + report, no push
 */
import { SQL } from 'bun';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Create .env.local at the repo root:');
  console.error('  DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require');
  process.exit(1);
}

const DRY = process.argv.includes('--dry-run');
const TOKEN = process.env.PRICESHEET_TOKEN || '';
const REPO_URL = TOKEN
  ? `https://x-access-token:${TOKEN}@github.com/PRTLabs/pricesheet.git`
  : 'https://github.com/PRTLabs/pricesheet.git';

const sql = new SQL(url);

// Same derivation as ProductDetailsTab.derivedGroup — keep in lockstep.
const derivedGroup = (name: string) => name.replace(/\s+\d+[a-z+]*$/i, '').toUpperCase();

type ProductRow = {
  id: number; name: string; vials_per_unit: number; list_price: string;
  promo_badge: boolean; pricelist_status_override: string;
  pricelist_group: string | null; pricelist_spec: string | null;
  pricelist_note: string | null; pricelist_sort: number;
  sellable: number; inbound: boolean;
  coa_ref: string | null; coa_url: string | null;
};
type TierRow = { product_id: number; min_quantity: number; unit_price: string };

const OVERRIDE_STATUS: Record<string, string> = {
  available: 'AVAILABLE',
  in_production: 'IN PRODUCTION',
  in_transit: 'IN TRANSIT',
  out_of_stock: 'OUT OF STOCK',
};

async function loadRows() {
  const products = await sql`
    SELECT p.id, p.name, p.vials_per_unit, p.list_price,
      p.promo_badge, p.pricelist_status_override, p.pricelist_group,
      p.pricelist_spec, p.pricelist_note, p.pricelist_sort,
      COALESCE((
        SELECT SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))
        FROM inventory i
        JOIN product_batches pb ON pb.id = i.batch_id AND pb.qc_status = 'passed'
        JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active
        WHERE i.product_id = p.id
      ), 0)::int AS sellable,
      EXISTS (
        SELECT 1 FROM shipments_inbound_items sii
        JOIN shipments_inbound si ON si.id = sii.shipment_id
        JOIN product_batches pb2 ON pb2.id = sii.batch_id
        WHERE pb2.product_id = p.id
          AND si.status <> 'delivered'
          AND COALESCE(sii.quantity_shipped, 0) - COALESCE(sii.quantity_received, 0) > 0
      ) AS inbound,
      cb.batch_number AS coa_ref, cb.coa_url
    FROM products p
    LEFT JOIN LATERAL (
      SELECT pb.batch_number, COALESCE(rep.url, NULLIF(pb.coa_url, '')) AS coa_url
      FROM product_batches pb
      LEFT JOIN LATERAL (
        -- Passing tests grouped by certificate link (a test with no report
        -- URL of its own belongs to the batch's coa_url); highest mass-spec
        -- content wins, purity breaks ties.
        SELECT COALESCE(NULLIF(bt.test_report_url, ''), NULLIF(pb.coa_url, '')) AS url
        FROM batch_tests bt
        WHERE bt.batch_id = pb.id AND bt.pass_fail = 'pass'
        GROUP BY COALESCE(NULLIF(bt.test_report_url, ''), NULLIF(pb.coa_url, ''))
        HAVING COALESCE(NULLIF(bt.test_report_url, ''), NULLIF(pb.coa_url, '')) IS NOT NULL
        ORDER BY
          MAX(bt.result_value) FILTER (WHERE bt.test_type = 'mass_spec') DESC NULLS LAST,
          MAX(bt.result_value) FILTER (WHERE bt.test_type = 'hplc_purity') DESC NULLS LAST,
          -- Deterministic tiebreak: a coin-flip winner would churn a new
          -- pricesheet commit on every sync run.
          COALESCE(NULLIF(bt.test_report_url, ''), NULLIF(pb.coa_url, ''))
        LIMIT 1
      ) rep ON true
      WHERE pb.product_id = p.id AND pb.qc_status = 'passed'
        AND (COALESCE(pb.coa_url, '') <> '' OR rep.url IS NOT NULL)
      ORDER BY pb.manufacture_date DESC NULLS LAST, pb.id DESC
      LIMIT 1
    ) cb ON true
    WHERE p.show_on_pricelist AND p.is_active
    ORDER BY
      -- Groups order by their best sort value (kept whole even when
      -- members disagree — a split group would render as two headings)…
      MIN(p.pricelist_sort) OVER (PARTITION BY COALESCE(NULLIF(p.pricelist_group, ''), p.name)),
      COALESCE(NULLIF(p.pricelist_group, ''), p.name),
      -- …and variants inside a group order by mass, low to high: the
      -- leading number of the spec ("30mg × 10 vials" → 30), else the
      -- trailing number of the product name ("Tirzepatide 60" → 60).
      COALESCE(
        substring(NULLIF(p.pricelist_spec, '') from '^([0-9]+(\\.[0-9]+)?)')::numeric,
        substring(p.name from '([0-9]+(\\.[0-9]+)?)[ ]*([mM][gG])?[ ]*$')::numeric,
        0),
      p.name
  ` as ProductRow[];

  const tiers = await sql`
    SELECT product_id, min_quantity, unit_price
    FROM product_price_tiers
    ORDER BY product_id, min_quantity DESC
  ` as TierRow[];

  const tiersByProduct = new Map<number, TierRow[]>();
  for (const t of tiers) {
    const arr = tiersByProduct.get(Number(t.product_id)) ?? [];
    arr.push(t);
    tiersByProduct.set(Number(t.product_id), arr);
  }

  // Effective unit price at a quantity: best tier (rows pre-sorted by
  // min_quantity DESC) whose threshold the quantity meets, else list.
  const priceAt = (p: ProductRow, qty: number): number => {
    const t = (tiersByProduct.get(Number(p.id)) ?? []).find(r => Number(r.min_quantity) <= qty);
    return Number(t ? t.unit_price : p.list_price);
  };

  return products.map(p => {
    const override = OVERRIDE_STATUS[p.pricelist_status_override];
    const status = override
      ?? (Number(p.sellable) > 0 ? 'AVAILABLE' : p.inbound ? 'IN TRANSIT' : 'OUT OF STOCK');
    return [
      (p.pricelist_group || '').trim() || derivedGroup(p.name),
      (p.pricelist_note || '').trim(),
      (p.pricelist_spec || '').trim() || `${Number(p.vials_per_unit)} vials`,
      status,
      // Sheet columns: 1 kit / 2+ kits / 20+ kits.
      priceAt(p, 1), priceAt(p, 2), priceAt(p, 20),
      p.coa_url ? (p.coa_ref || '') : '',
      p.coa_url || '',
      p.promo_badge ? 1 : 0,
      // Total sellable inventory across warehouses — shown under the
      // Available chip (same figure that drives the auto status).
      Number(p.sellable),
    ] as const;
  });
}

/** The dc-script the sheet runs — data array injected, promo data-driven. */
function buildScript(dataRows: readonly (readonly unknown[])[], stamp: string): string {
  // "<\/" inside a JS string literal still means "</" — but keeps a literal
  // "</script>" (possible in product text or a COA URL) out of the script
  // body, which would otherwise break both the browser's tag parsing and
  // this tool's own extraction regex on the next run.
  const dataLiteral = dataRows.map(r => '      ' + JSON.stringify(r).replace(/<\//g, '<\\/')).join(',\n');
  return `
class Component extends DCLogic {
  renderVals() {
    const statusStyles = {
      'AVAILABLE':      { label: 'Available',      color: '#1e7a3c', bg: '#e6f4ea' },
      'IN PRODUCTION':  { label: 'In production',  color: '#8a6100', bg: '#fdf3d7' },
      'IN TRANSIT':     { label: 'In transit',     color: '#2d5d80', bg: '#e8f0f6' },
      'OUT OF STOCK':   { label: 'Out of stock',   color: '#8c1219', bg: '#fbe9ea' },
    };
    // GENERATED by tools/sync-pricesheet.ts in the prtmgmt repo — do not
    // hand-edit rows here; change the products in the Peptide Ops app.
    const data = [
${dataLiteral}
    ];
    const fmt = (n) => '$' + (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2));
    const showOos = this.props.showOutOfStock ?? true;
    const groups = [];
    data.forEach(([name, sub, content, statusKey, p1, p2, p3, coa, coaUrl, promoFlag, stock]) => {
      const s = statusStyles[statusKey];
      const oos = statusKey === 'OUT OF STOCK';
      if (!showOos && oos) return;
      let g = groups[groups.length - 1];
      if (!g || g.name !== name) {
        g = { name, sub, variants: [] };
        groups.push(g);
      }
      g.variants.push({
        promo: promoFlag ? (this.props.promoLabel ?? 'Promo') : '',
        stockNote: (statusKey === 'AVAILABLE' && stock > 0) ? stock + ' in stock' : '',
        content, coa,
        coaUrl: coaUrl || '',
        borderTop: g.variants.length ? '1px solid #eef2f5' : 'none',
        status: oos ? 'Coming soon' : s.label,
        statusColor: oos ? '#8c1219' : s.color,
        statusBg: oos ? '#fbe9ea' : s.bg,
        p1: fmt(p1), p2: fmt(p2), p3: fmt(p3),
        priceMuted: oos ? '#a8a39d' : '#433f3b',
        priceStrong: oos ? '#a8a39d' : '#202c39',
      });
    });
    groups.forEach((g, i) => {
      g.bg = i % 2 === 1 ? '#fafbfc' : '#ffffff';
      g.borderTop = i === 0 ? 'none' : '1px solid #e3e9ee';
    });
    return {
      groups,
      effectiveDate: this.props.effectiveDate ?? '${stamp}',
    };
  }
}
`;
}

/** "August 21, 2026, 9:45 PM CT" — the moment of the last real update. */
function freshStamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' CT';
}

/** The stamp currently on the published sheet (props default). */
function currentStamp(indexHtml: string): string | null {
  const m = indexHtml.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (!m) return null;
  const template = JSON.parse(m[1]) as string;
  const pm = template.match(/data-props="([^"]*)"/);
  if (!pm) return null;
  try {
    const props = JSON.parse(pm[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) as
      { effectiveDate?: { default?: string } };
    return props.effectiveDate?.default ?? null;
  } catch {
    return null;
  }
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function rebuildIndexHtml(indexHtml: string, script: string, stamp: string): string {
  const m = indexHtml.match(/(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/);
  if (!m) throw new Error('pricesheet index.html: __bundler/template script tag not found');
  let template = JSON.parse(m[2]) as string;

  const props = {
    effectiveDate: { editor: 'text', default: stamp, tsType: 'string' },
    showOutOfStock: { editor: 'boolean', default: true, tsType: 'boolean' },
    promoLabel: { editor: 'text', default: 'Promo', tsType: 'string' },
  };
  const newTag = `<script type="text/x-dc" data-dc-script="" data-props="${escAttr(JSON.stringify(props))}">${script}</script>`;

  const scriptRe = /<script type="text\/x-dc"[^>]*data-dc-script[^>]*>[\s\S]*?<\/script>/;
  if (!scriptRe.test(template)) throw new Error('pricesheet template: x-dc data script not found');
  // Function form: a plain string replacement would expand "$'" inside the
  // generated script (fmt's dollar sign) as a replace pattern.
  template = template.replace(scriptRe, () => newTag);

  // "</" must not appear literally inside the wrapper's <script> tag or the
  // browser (and our own extraction) would end the tag at the first embedded
  // "</script>". "<\/" is the standard JSON-safe escape.
  const embedded = JSON.stringify(template).replace(/<\//g, '<\\/');
  return indexHtml.slice(0, m.index! + m[1].length) + embedded + indexHtml.slice(m.index! + m[1].length + m[2].length);
}

function run(cwd: string | null, cmd: string[], allowFail = false): string {
  const res = Bun.spawnSync(cmd, { cwd: cwd ?? undefined, stdout: 'pipe', stderr: 'pipe' });
  const out = new TextDecoder().decode(res.stdout) + new TextDecoder().decode(res.stderr);
  if (res.exitCode !== 0 && !allowFail) {
    // Never echo the push URL (it may carry the token).
    throw new Error(`${cmd[0]} ${cmd[1] ?? ''} failed (exit ${res.exitCode}): ${out.replace(TOKEN, '***').slice(0, 500)}`);
  }
  return out;
}

async function main() {
  const rows = await loadRows();
  console.log(`Generated ${rows.length} price sheet row(s):`);
  for (const r of rows) console.log('  ' + JSON.stringify(r));
  if (rows.length === 0) {
    // Refuse to blank the public sheet — an empty result means the
    // products just haven't been flagged yet, not that the catalog is gone.
    console.warn('No products are flagged show_on_pricelist — refusing to publish an empty sheet.');
    if (!DRY) return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'pricesheet-'));
  run(null, ['git', 'clone', '--depth', '1', REPO_URL, dir]);

  const indexPath = join(dir, 'index.html');
  const current = await Bun.file(indexPath).text();

  // Change detection runs with the PUBLISHED timestamp, so the stamp only
  // advances when the sheet's actual content moved — otherwise a fresh
  // time every run would commit a "changed" sheet every 15 minutes.
  const oldStamp = currentStamp(current) ?? freshStamp();
  await Bun.write(indexPath, rebuildIndexHtml(current, buildScript(rows, oldStamp), oldStamp));
  const dirty = run(dir, ['git', 'status', '--porcelain']).trim() !== '';
  if (!dirty) {
    console.log('Price sheet already up to date — nothing to publish.');
    return;
  }
  const stamp = freshStamp();
  await Bun.write(indexPath, rebuildIndexHtml(current, buildScript(rows, stamp), stamp));
  if (DRY) {
    console.log(`DRY RUN: regenerated sheet differs. Preview at ${indexPath} (not committed).`);
    return;
  }
  run(dir, ['git', 'config', 'user.name', 'Peptide Ops Sync']);
  run(dir, ['git', 'config', 'user.email', 'sync@prtlabs.invalid']);
  run(dir, ['git', 'add', 'index.html']);
  run(dir, ['git', 'commit', '-m', `Sync from Peptide Ops — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`]);
  run(dir, ['git', 'push', 'origin', 'HEAD:main']);
  console.log('Price sheet updated and pushed.');
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); },
);
