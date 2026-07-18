/**
 * Snapshot / restore the entire Peptide Ops database (Neon).
 *
 *   bun tools/snapshot-db.ts snapshot <name>   # dump all tables to .snapshots/<name>.json
 *   bun tools/snapshot-db.ts restore <name>    # wipe app tables and reload the snapshot
 *
 * Restore rewinds ALL app data (orders, inventory, everything) to the
 * snapshot moment and realigns identity sequences + sales_order_seq.
 * The migration ledger (claude_migrations_applied) is left untouched.
 */
import { SQL } from 'bun';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// FK-safe insert order (reverse order for deletes).
const ORDER = [
  'factories', 'warehouses', 'warehouse_shipping_rate_plans', 'receive_wallets',
  'free_order_reasons', 'product_categories', 'products', 'product_price_tiers',
  'product_price_history', 'product_batches', 'batch_tests', 'customers',
  'user_profiles', 'user_payout_addresses', 'customer_notes', 'customer_note_audit_log',
  'sales_orders', 'sales_order_items', 'sales_order_item_allocations', 'order_audit_log',
  'order_payments', 'refund_tasks', 'inventory', 'inventory_reservations',
  'inventory_writeoffs', 'inventory_count_corrections', 'inter_warehouse_transfers',
  'warehouse_activity_log', 'warehouse_receive_addresses', 'shipments_inbound',
  'shipment_documents', 'shipments_inbound_items', 'shipments_outbound',
  'shipments_outbound_items', 'notifications_sent', 'commission_payments',
  'app_settings',
];

const [mode, name] = process.argv.slice(2);
if (!['snapshot', 'restore'].includes(mode) || !name) {
  console.error('Usage: bun tools/snapshot-db.ts snapshot|restore <name>');
  process.exit(1);
}
const dir = join(import.meta.dir, '..', '.snapshots');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${name}.json`);

const sql = new SQL(process.env.DATABASE_URL!);
await sql`SELECT pg_advisory_lock(74206944)`;

if (mode === 'snapshot') {
  const data: Record<string, unknown[]> = {};
  for (const t of ORDER) {
    data[t] = (await sql.unsafe(`SELECT COALESCE(json_agg(x ORDER BY x.id), '[]'::json) AS j FROM ${t} x`))[0].j;
  }
  writeFileSync(file, JSON.stringify(data));
  for (const t of ORDER) if ((data[t] as unknown[]).length) console.log(`${t}: ${(data[t] as unknown[]).length}`);
  console.log(`Snapshot written: ${file}`);
} else {
  const data: Record<string, Record<string, unknown>[]> = JSON.parse(readFileSync(file, 'utf8'));
  const lit = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  await sql.begin(async tx => {
    for (const t of [...ORDER].reverse()) await tx.unsafe(`DELETE FROM ${t}`);
    // GENERATED ALWAYS ... STORED columns must not be inserted explicitly
    // (OVERRIDING SYSTEM VALUE covers identity columns only).
    const GENERATED: Record<string, string[]> = { inventory_count_corrections: ['delta'] };
    for (const t of ORDER) {
      const rows = data[t] ?? [];
      if (rows.length === 0) continue;
      const cols = Object.keys(rows[0]).filter(c => !(GENERATED[t] || []).includes(c));
      const values = rows.map(r => `(${cols.map(c => lit(r[c])).join(', ')})`).join(',\n');
      await tx.unsafe(`INSERT INTO ${t} (${cols.join(', ')}) OVERRIDING SYSTEM VALUE VALUES\n${values}`);
    }
    for (const t of ORDER) {
      await tx.unsafe(`SELECT setval(pg_get_serial_sequence('${t}', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t}), 1),
        (SELECT COUNT(*) > 0 FROM ${t}))`);
    }
    await tx.unsafe(`SELECT setval('sales_order_seq',
      GREATEST((SELECT COALESCE(MAX((regexp_match(order_number, '(\\d+)$'))[1]::int), 0) FROM sales_orders), 1),
      (SELECT COUNT(*) > 0 FROM sales_orders))`);
  });
  let ok = true;
  for (const t of ORDER) {
    const expected = (data[t] ?? []).length;
    const actual = (await sql.unsafe(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n;
    if (actual !== expected) { ok = false; console.log(`MISMATCH ${t}: ${actual}/${expected}`); }
  }
  console.log(ok ? 'Restore complete — all counts match.' : 'RESTORE HAD MISMATCHES');
}
await sql.end();
