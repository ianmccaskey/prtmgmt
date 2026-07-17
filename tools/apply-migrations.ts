/**
 * Applies pending src/migrations/*.sql directly to the Peptide Ops DB,
 * replacing UI Bakery's migration runner (which reports pending files but
 * never executes them).
 *
 * Setup: create .env.local at the repo root (gitignored) containing
 *   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
 * with the external connection details from the UI Bakery datasource.
 *
 * Usage (from the repo root):
 *   bun tools/apply-migrations.ts --status   # show applied vs pending
 *   bun tools/apply-migrations.ts            # apply pending in order
 *
 * Ledger: claude_migrations_applied table in the DB itself. The three
 * migrations UI Bakery's own runner applied (schema, seed, commissions)
 * are baselined on first run and never re-executed — they are NOT
 * idempotent. Everything after them is written to be re-runnable, so a
 * replay by UI Bakery's runner (if it ever starts working) is harmless.
 */
import { SQL } from 'bun';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = [
  '1751680843_create_peptide_ops_schema',
  '1751680900_seed_data',
  '1783536889_add_commissions',
];

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'src', 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Create .env.local at the repo root:');
  console.error('  DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require');
  process.exit(1);
}

const sql = new SQL(url);

// Serialize runners: a second invocation blocks here until the first
// finishes, so two runs can't both see the same file as pending and race
// the check-then-add DO blocks. Released automatically on disconnect.
await sql`SELECT pg_advisory_lock(74206942)`;

const files = readdirSync(MIGRATIONS_DIR)
  .filter(f => /^\d+_.+\.sql$/.test(f))
  .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]));

await sql`CREATE TABLE IF NOT EXISTS claude_migrations_applied (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
for (const name of BASELINE) {
  await sql`INSERT INTO claude_migrations_applied (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
}

const appliedRows = await sql`SELECT name FROM claude_migrations_applied`;
const applied = new Set(appliedRows.map((r: { name: string }) => r.name));
const pending = files.filter(f => !applied.has(f.replace(/\.sql$/, '')));

if (process.argv.includes('--status')) {
  console.log(`Applied (${applied.size}):`);
  for (const n of [...applied].sort()) console.log(`  ✓ ${n}`);
  console.log(`Pending (${pending.length}):`);
  for (const f of pending) console.log(`  … ${f}`);
  await sql.end();
  process.exit(0);
}

if (pending.length === 0) {
  console.log('Nothing pending — database is current.');
  await sql.end();
  process.exit(0);
}

for (const file of pending) {
  const name = file.replace(/\.sql$/, '');
  const body = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  process.stdout.write(`Applying ${name} … `);
  try {
    // No parameters → simple query protocol, so multi-statement files
    // (including DO $$ blocks) execute as-is.
    await sql.unsafe(body);
    await sql`INSERT INTO claude_migrations_applied (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
    console.log('done');
  } catch (e) {
    console.log('FAILED');
    console.error(e instanceof Error ? e.message : e);
    console.error(`Stopped at ${name}; nothing after it was run.`);
    await sql.end();
    process.exit(1);
  }
}

console.log(`Applied ${pending.length} migration(s). Database is current.`);
await sql.end();
