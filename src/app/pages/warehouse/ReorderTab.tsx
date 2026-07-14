import React from 'react';
import { useLoadAction } from '@uibakery/data';
import listReorderSuggestionsAction from '@/actions/warehouse/listReorderSuggestions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info } from 'lucide-react';

const REORDER_COVER_DAYS = 60;

type ReorderRow = {
  product_id: number; sku: string; product_name: string; low_stock_threshold: number;
  total_available: number; in_transit_inbound: number; sales_last_30d: number;
};

export function ReorderTab() {
  const [suggestions, loading] = useLoadAction(listReorderSuggestionsAction, [], {});
  const rows: ReorderRow[] = Array.isArray(suggestions) ? suggestions : [];

  const calcRecommended = (row: ReorderRow) => {
    const dailyVelocity = Number(row.sales_last_30d) / 30;
    const needed = Math.ceil(dailyVelocity * REORDER_COVER_DAYS);
    const netNeeded = Math.max(0, needed - Number(row.in_transit_inbound));
    return { dailyVelocity: dailyVelocity.toFixed(1), recommended: netNeeded };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base">Reorder Suggestions</CardTitle>
          <Badge variant="secondary">{rows.length} products</Badge>
          <span className="text-xs text-slate-400 ml-auto">Cover days: {REORDER_COVER_DAYS}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
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
                      <TooltipContent><p className="text-xs">daily_velocity × {REORDER_COVER_DAYS} days − in_transit</p></TooltipContent>
                    </Tooltip></TooltipProvider>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const { dailyVelocity, recommended } = calcRecommended(r);
                return (
                  <tr key={r.product_id} className="border-b hover:bg-slate-50 bg-red-50/30">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{r.product_name}</div>
                      <div className="text-xs text-slate-400">{r.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">{r.total_available}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{r.low_stock_threshold}</td>
                    <td className="px-4 py-2 text-right text-purple-600">{r.in_transit_inbound}</td>
                    <td className="px-4 py-2 text-right">{r.sales_last_30d}</td>
                    <td className="px-4 py-2 text-right">{dailyVelocity}/day</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-700">{recommended}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No reorder needed — all products above threshold</td></tr>}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
