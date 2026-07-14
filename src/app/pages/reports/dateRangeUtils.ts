export type DateRange = { from: string; to: string };

export function getPresetRange(preset: string): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'this_month': {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case 'last_month': {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case 'this_quarter': {
      const q = Math.floor(month / 3);
      const from = new Date(year, q * 3, 1);
      const to = new Date(year, q * 3 + 3, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case 'last_quarter': {
      const q = Math.floor(month / 3) - 1;
      const qYear = q < 0 ? year - 1 : year;
      const qAdj = q < 0 ? 3 : q;
      const from = new Date(qYear, qAdj * 3, 1);
      const to = new Date(qYear, qAdj * 3 + 3, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case 'this_year': {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'last_year': {
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    }
    default:
      return { from: '', to: '' };
  }
}

export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r =>
    headers.map(h => {
      const v = r[h];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
