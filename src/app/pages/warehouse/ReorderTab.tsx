import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import listReorderSuggestionsAction from '@/actions/warehouse/listReorderSuggestions';
import getAppSetting from '@/actions/settings/getAppSetting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info, Truck } from 'lucide-react';

type ReorderRow = {
  product_id: number; sku: string; product_name: string; low_stock_threshold: number;
  total_available: number; in_transit_inbound: number; sales_last_30d: number;
};

export type ReorderPrefillItem = { product_id: number; product_name: string; sku: string; quantity: number };

export function ReorderTab() {
  const navigate = useNavigate();
  const [suggestions, loading] = useLoadAction(listReorderSuggestionsAction, [], {});
  const [setting] = useLoadAction(getAppSetting, [], { key: 'reorder_cover_days' });
  const rows: ReorderRow[] = Array.isArray(suggestions) ? suggestions : [];
  const coverDays = Number(((setting as { value: string }[]) || [])[0]?.value) || 60;
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Prompt formula: ceil(velocity × cover_days) − available − in_transit, floored at 0.
  const calcRecommended = (row: ReorderRow) => {
    const dailyVelocity = Number(row.sales_last_30d) / 30;
    const needed = Math.ceil(dailyVelocity * coverDays);
    const recommended = Math.max(0, needed - Number(row.total_available) - Number(row.in_transit_inbound));
    return { dailyVelocity, needed, recommended };
  };

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const createShipmentForSelected = () => {
    const items: ReorderPrefillItem[] = rows
      .filter(r => selected.has(r.product_id))
      .map(r => ({ product_id: r.product_id, product_name: r.product_name, sku: r.sku, quantity: calcRecommended(r).recommended }))
      .filter(i => i.quantity > 0);
    if (items.length === 0) return;
    navigate('/logistics', { state: { prefillItems: items } });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base">Reorder Suggestions</CardTitle>
          <Badge variant="secondary">{rows.length} products</Badge>
          <span className="text-xs text-slate-400">Cover days: {coverDays} (Settings → Reorder Planning)</span>
          <Button size="sm" className="ml-auto" disabled={selected.size === 0} onClick={createShipmentForSelected}>
            <Truck className="h-3 w-3 mr-1" /> Create Inbound Shipment ({selected.size})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-2 w-8">
                  <input type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.product_id)) : new Set())} />
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Product</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Available</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Threshold</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">In-Transit</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Sales 30d</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Daily Vel.</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">
                  <div className="flex items-center justify-end gap-1">
                    Recommended
                    <TooltipProvider><Tooltip><TooltipTrigger><Info className="h-3 w-3 text-slate-400" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">ceil(daily velocity × {coverDays} cover days) − available − in-transit</p></TooltipContent>
                    </Tooltip></TooltipProvider>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const { dailyVelocity, needed, recommended } = calcRecommended(r);
                return (
                  <tr key={r.product_id} className="border-b hover:bg-slate-50 bg-red-50/30">
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={selected.has(r.product_id)} onChange={() => toggle(r.product_id)} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{r.product_name}</div>
                      <div className="text-xs text-slate-400">{r.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">{r.total_available}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{r.low_stock_threshold}</td>
                    <td className="px-4 py-2 text-right text-purple-600">{r.in_transit_inbound}</td>
                    <td className="px-4 py-2 text-right">{r.sales_last_30d}</td>
                    <td className="px-4 py-2 text-right">{dailyVelocity.toFixed(1)}/day</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-700">
                      <TooltipProvider><Tooltip>
                        <TooltipTrigger>{recommended}</TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-60">
                            Sold {r.sales_last_30d} kits/30d = {dailyVelocity.toFixed(1)}/day. Cover {coverDays} days = {needed}.
                            Have {r.total_available} available + {r.in_transit_inbound} in-transit. Suggest {recommended}.
                          </p>
                        </TooltipContent>
                      </Tooltip></TooltipProvider>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No reorder needed — all products above threshold</td></tr>}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
