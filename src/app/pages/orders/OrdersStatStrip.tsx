import React from 'react';
import { useLoadAction } from '@/lib/data';
import { firstRow } from '@/lib/rows';
import getOrdersStatStrip from '@/actions/orders/getOrdersStatStrip';
import { useAppUser } from '@/app/AppContext';

type StatStripRow = {
  confirmed_count: string;
  quote_count: string;
  shipped_this_month: string;
  revenue_this_month: string;
  unpaid_balance: string;
  china_direct_awaiting: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-4 py-2 min-w-0 bg-background">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className="text-sm font-semibold text-foreground mt-0.5">{value}</span>
    </div>
  );
}

export function OrdersStatStrip() {
  const { isSalesRep, profileId } = useAppUser();
  // Reps' stat cards cover their own orders only, matching the list below.
  const repScope = isSalesRep && profileId != null ? String(profileId) : null;
  const [raw] = useLoadAction(getOrdersStatStrip, [], { repScope });
  // Unknown is not zero: until the row loads (or when the read fails) every
  // stat shows '—', never "$0" / "0" that reads as "nothing owed".
  const row = firstRow<StatStripRow>(raw);
  const data: StatStripRow = row ?? {} as StatStripRow;

  const fmtUSD = (v: string) => {
    if (!row) return '—';
    const n = parseFloat(v);
    return isNaN(n) ? '$0' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const fmt = (v: string) => (!row ? '—' : v ?? '0');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/60 border border-border/60 rounded-lg overflow-hidden">
      <Stat label="Quotes" value={fmt(data.quote_count)} />
      <Stat label="Confirmed" value={fmt(data.confirmed_count)} />
      <Stat label="Shipped (Month)" value={fmt(data.shipped_this_month)} />
      <Stat label="Revenue (Month)" value={fmtUSD(data.revenue_this_month)} />
      <Stat label="Unpaid Balance" value={fmtUSD(data.unpaid_balance)} />
      <Stat label="China-Direct Awaiting" value={fmt(data.china_direct_awaiting)} />
    </div>
  );
}
