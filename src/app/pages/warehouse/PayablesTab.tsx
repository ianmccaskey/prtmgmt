import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listWarehousePayablesAction from '@/actions/warehouse/listWarehousePayables';
import listOwedShipmentsAction from '@/actions/warehouse/listOwedShipments';
import markShipmentsPaidAction from '@/actions/warehouse/markShipmentsPaid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';

type Payable = { warehouse_id: number; warehouse_name: string; owed_shipments_count: number; owed_usd_total: number };
type OwedShipment = { id: number; order_number: string; shipped_date: string; internal_shipping_cost_usd: number; total_kits: number; carrier: string; tracking_number: string };

export function PayablesTab() {
  const { profileId, isAdmin, isWarehouse, assignedWarehouseId } = useAppUser();
  // Warehouse users see only what THEIR warehouse is owed — filtered in
  // the query, not just the render.
  const whParam = isWarehouse && assignedWarehouseId ? String(assignedWarehouseId) : '';
  const [payables, loading, , reload] = useLoadAction(listWarehousePayablesAction, [whParam], { warehouse_id: whParam });
  const rows: Payable[] = asRows(payables);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [markPaid] = useMutateAction(markShipmentsPaidAction);
  const [paying, setPaying] = useState(false);

  const [owed, owedLoading] = useLoadAction(listOwedShipmentsAction, [expanded], { warehouse_id: expanded }, { enabled: expanded !== null });
  const owedRows: OwedShipment[] = asRows(owed);

  const totalOwed = rows.reduce((s, r) => s + Number(r.owed_usd_total), 0);

  const handleMarkPaid = async () => {
    if (selected.size === 0) return;
    setPaying(true);
    await markPaid({ shipment_ids: `{${Array.from(selected).join(',')}}`, user_id: profileId });
    setSelected(new Set());
    setPaying(false);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <span className="font-semibold text-slate-700">Total Owed: <span className="text-green-600">${Number(totalOwed).toFixed(2)}</span></span>
        </div>
        {selected.size > 0 && isAdmin && (
          <Button size="sm" onClick={handleMarkPaid} disabled={paying}>
            <CheckSquare className="h-4 w-4 mr-1" />{paying ? 'Marking Paid…' : `Mark ${selected.size} Paid`}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Warehouse Payables</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <div>
              {rows.map(r => (
                <div key={r.warehouse_id} className="border-b">
                  <div
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === r.warehouse_id ? null : r.warehouse_id)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded === r.warehouse_id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <span className="font-medium">{r.warehouse_name}</span>
                      <span className="text-xs text-slate-400">{r.owed_shipments_count} shipments</span>
                    </div>
                    <span className="font-bold text-green-600">${Number(r.owed_usd_total).toFixed(2)}</span>
                  </div>
                  {expanded === r.warehouse_id && (
                    <div className="bg-slate-50 border-t">
                      {owedLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left px-6 py-2 font-medium text-slate-500 text-xs">
                                <input type="checkbox" className="mr-2" onChange={e => {
                                  if (e.target.checked) setSelected(new Set(owedRows.map(o => o.id)));
                                  else setSelected(new Set());
                                }} />
                                Order
                              </th>
                              <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Shipped</th>
                              <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">Kits</th>
                              <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {owedRows.map(o => (
                              <tr key={o.id} className="border-t hover:bg-white">
                                <td className="px-6 py-2">
                                  <input type="checkbox" className="mr-2" checked={selected.has(o.id)} onChange={e => {
                                    const next = new Set(selected);
                                    if (e.target.checked) next.add(o.id); else next.delete(o.id);
                                    setSelected(next);
                                  }} />
                                  <span className="font-mono text-blue-600">{o.order_number || `#${o.id}`}</span>
                                </td>
                                <td className="px-4 py-2 text-slate-500">{o.shipped_date ? new Date(o.shipped_date).toLocaleDateString() : '—'}</td>
                                <td className="px-4 py-2 text-right">{o.total_kits}</td>
                                <td className="px-4 py-2 text-right font-medium">${Number(o.internal_shipping_cost_usd).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {rows.length === 0 && <div className="text-center py-8 text-slate-400">No outstanding payables</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
