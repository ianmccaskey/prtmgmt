/**
 * Format a DATE-ONLY database value without timezone conversion.
 *
 * A Postgres `date` arrives as "2026-09-12T00:00:00.000Z" — midnight UTC.
 * `new Date(...).toLocaleDateString()` converts that to local time, which
 * is the PREVIOUS evening anywhere west of UTC, so every date-only field
 * rendered that way showed a day early. This reads the calendar date
 * straight off the string instead.
 *
 * Use ONLY for `date` columns (order_date, manufacture_date, test_date,
 * expense_date, shipped_date, arrival dates, due_date). Real timestamps
 * (created_at, paid_at, verified_at, …) must keep new Date().toLocale…:
 * converting those to local time is the correct behavior.
 */
export function fmtDate(v: unknown): string {
  if (v == null || v === '') return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(String(v)).toLocaleDateString();
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

export default fmtDate;
