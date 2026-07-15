import React from 'react';
import { useLoadAction } from '@uibakery/data';
import getOrdersStatStrip from '@/actions/orders/getOrdersStatStrip';

type StatStripRow = {
  confirmed_count: string;
  in_production_count: string;
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
  const [raw] = useLoadAction(getOrdersStatStrip, []);
  const data: StatStripRow = (raw as StatStripRow[])[0] ?? {} as StatStripRow;

  const fmtUSD = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? '$0' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const fmt = (v: string) => v ?? '0';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/60 border border-border/60 rounded-lg overflow-hidden">
      <Stat label="Confirmed" value={fmt(data.confirmed_count)} />
      <Stat label="In Production" value={fmt(data.in_production_count)} />
      <Stat label="Shipped (Month)" value={fmt(data.shipped_this_month)} />
      <Stat label="Revenue (Month)" value={fmtUSD(data.revenue_this_month)} />
      <Stat label="Unpaid Balance" value={fmtUSD(data.unpaid_balance)} />
      <Stat label="China-Direct Awaiting" value={fmt(data.china_direct_awaiting)} />
    </div>
  );
}
