import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { useNavigate } from 'react-router-dom';
import { useAppUser } from '@/app/AppContext';
import listWarehouseBalances from '@/actions/commissions/listWarehouseBalances';
import listWarehouseCommissionShipments from '@/actions/commissions/listWarehouseCommissionShipments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dbText } from '@/lib/dbText';
import { DollarSign, ChevronDown, ChevronRight, HandCoins } from 'lucide-react';

type Balance = {
  warehouse_id: number; warehouse_name: string;
  commission_earned_usd: number; paid_total_usd: number; balance_owed_usd: number;
  shipments_count: number;
};
type ShipmentRow = {
  shipment_id: number; order_number: string; shipped_date: string;
  carrier: string; tracking_number?: string; internal_shipping_cost_usd: number; total_kits: number;
};

/**
 * Read-only ledger view: what each warehouse has earned in shipping costs,
 * what's been paid via commission payments, and the open balance. No
 * per-shipment "mark paid" — payments are recorded as lump sums on the
 * Commissions page and net against the balance here.
 */
export function PayablesTab({ warehouseId }: { warehouseId: string }) {
  const { isAdmin } = useAppUser();
  const navigate = useNavigate();
  // Follows the page's warehouse switcher ('' = all). Warehouse users are
  // scoped automatically — their switcher is locked to their warehouse.
  const whParam = warehouseId;
  const [balancesRaw, loading] = useLoadAction(listWarehouseBalances, [whParam], { warehouse_id: whParam });
  const rows: Balance[] = asRows<Balance>(balancesRaw).filter(r => Number(r.commission_earned_usd) > 0 || Number(r.paid_total_usd) > 0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [shipmentsRaw, shipmentsLoading] = useLoadAction(listWarehouseCommissionShipments, [expanded], { warehouse_id: expanded, date_from: null, date_to: null }, { enabled: expanded !== null });
  const shipmentRows: ShipmentRow[] = asRows(shipmentsRaw);

  const totalBalance = rows.reduce((s, r) => s + Number(r.balance_owed_usd), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <span className="font-semibold text-slate-700">Balance Owed: <span className="text-green-600">${totalBalance.toFixed(2)}</span></span>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => navigate('/commissions')}>
            <HandCoins className="h-4 w-4 mr-1" /> Record Payment (Commissions)
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Warehouse Shipping Payables</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <div>
              {rows.map(r => (
                <div key={r.warehouse_id} className="border-b">
                  <div
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer gap-3 flex-wrap"
                    onClick={() => setExpanded(expanded === r.warehouse_id ? null : r.warehouse_id)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded === r.warehouse_id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <span className="font-medium">{r.warehouse_name}</span>
                      <span className="text-xs text-slate-400">{r.shipments_count} shipments</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">Earned <span className="font-medium text-slate-700">${Number(r.commission_earned_usd).toFixed(2)}</span></span>
                      <span className="text-slate-500">Paid <span className="font-medium text-slate-700">${Number(r.paid_total_usd).toFixed(2)}</span></span>
                      <span className={`font-bold ${Number(r.balance_owed_usd) > 0 ? 'text-green-600' : 'text-slate-500'}`}>${Number(r.balance_owed_usd).toFixed(2)} owed</span>
                    </div>
                  </div>
                  {expanded === r.warehouse_id && (
                    <div className="bg-slate-50 border-t">
                      {shipmentsLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
                        <div className="overflow-x-auto"><table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left px-6 py-2 font-medium text-slate-500 text-xs">Order</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Shipped</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Carrier</th>
                              <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">Kits</th>
                              <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shipmentRows.map(o => (
                              <tr key={o.shipment_id} className="border-t hover:bg-white">
                                <td className="px-6 py-2 font-mono text-blue-600">{o.order_number || `#${o.shipment_id}`}</td>
                                <td className="px-4 py-2 text-slate-500">{o.shipped_date ? new Date(o.shipped_date).toLocaleDateString() : '—'}</td>
                                <td className="px-4 py-2 text-slate-500">{o.carrier || '—'}{o.tracking_number ? ` · ${dbText(o.tracking_number)}` : ''}</td>
                                <td className="px-4 py-2 text-right">{o.total_kits}</td>
                                <td className="px-4 py-2 text-right font-medium">${Number(o.internal_shipping_cost_usd).toFixed(2)}</td>
                              </tr>
                            ))}
                            {shipmentRows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No shipments</td></tr>}
                          </tbody>
                        </table></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {rows.length === 0 && <div className="text-center py-8 text-slate-400">No shipping costs recorded yet</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
