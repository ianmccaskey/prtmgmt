import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import listWarehousesAction from '@/actions/warehouse/listWarehouses';
import getWarehouseStatsAction from '@/actions/warehouse/getWarehouseStats';
import getPerWarehouseBreakdownAction from '@/actions/warehouse/getPerWarehouseBreakdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, AlertTriangle, TrendingDown, Truck, ArrowLeftRight, DollarSign } from 'lucide-react';
import { InventoryTab } from '@/app/pages/warehouse/InventoryTab';
import { FulfillmentTab } from '@/app/pages/warehouse/FulfillmentTab';
import { ReorderTab } from '@/app/pages/warehouse/ReorderTab';
import { InTransitTab } from '@/app/pages/warehouse/InTransitTab';
import { TransfersTab } from '@/app/pages/warehouse/TransfersTab';
import { PayablesTab } from '@/app/pages/warehouse/PayablesTab';
import { ActivityTab } from '@/app/pages/warehouse/ActivityTab';
import { useAppUser } from '@/app/AppContext';

type Warehouse = { id: number; name: string; city: string; is_active: boolean };
type Stats = { total_skus: number; total_kits: number; total_retail_value: number; low_stock_count: number; kits_reserved: number; kits_in_transit_inbound: number; kits_in_transit_transfer: number };
type WHBreakdown = { warehouse_id: number; warehouse_name: string; city: string; skus_count: number; total_kits: number; reserved_kits: number; available_kits: number; retail_value: number };

export function WarehousePage() {
  const { isAdmin, isSalesRep, isWarehouse, isLogistics, assignedWarehouseId } = useAppUser();
  // Logistics coordinators see every tab (admin-level visibility) but the
  // tabs' mutation controls are gated off for them inside each tab.
  const seesOps = isAdmin || isWarehouse || isLogistics;
  // Warehouse users are locked to their assigned warehouse (access matrix).
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    isWarehouse && assignedWarehouseId ? String(assignedWarehouseId) : ''
  );
  const [warehouses] = useLoadAction(listWarehousesAction, [], {});
  const [stats, statsLoading] = useLoadAction(getWarehouseStatsAction, [], { warehouse_id: selectedWarehouseId });
  const [breakdown, breakdownLoading] = useLoadAction(getPerWarehouseBreakdownAction, [], {});

  const warehouseList: Warehouse[] = asRows(warehouses);
  const s: Stats | null = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
  const breakdownRows: WHBreakdown[] = asRows(breakdown);

  const statCards = [
    { label: 'SKUs in Stock', val: s?.total_skus ?? 0, icon: Package, color: 'text-blue-500' },
    { label: 'Total Kits', val: Number(s?.total_kits ?? 0).toLocaleString(), icon: Package, color: 'text-slate-600' },
    { label: 'Retail Value', val: `$${Number(s?.total_retail_value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-green-500' },
    { label: 'Low Stock SKUs', val: s?.low_stock_count ?? 0, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Kits Reserved', val: Number(s?.kits_reserved ?? 0).toLocaleString(), icon: TrendingDown, color: 'text-orange-500' },
    { label: 'In-Transit Inbound', val: Number(s?.kits_in_transit_inbound ?? 0).toLocaleString(), icon: Truck, color: 'text-purple-500' },
    { label: 'In-Transit Transfer', val: Number(s?.kits_in_transit_transfer ?? 0).toLocaleString(), icon: ArrowLeftRight, color: 'text-cyan-500' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header + warehouse switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse</h1>
          <p className="text-sm text-slate-500">Inventory, fulfillment, transfers & payables</p>
        </div>
        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId} disabled={isWarehouse}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            {!isWarehouse && <SelectItem value="">All Warehouses</SelectItem>}
            {warehouseList.filter(w => w.is_active && (!isWarehouse || w.id === assignedWarehouseId)).map(w => (
              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statsLoading ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          statCards.map(({ label, val, icon: Icon, color }) => (
            <Card key={label} className="p-3">
              <div className={`${color} mb-1`}><Icon className="h-4 w-4" /></div>
              <p className="text-lg font-bold text-slate-800">{val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </Card>
          ))
        )}
      </div>

      {/* Per-warehouse breakdown */}
      {!selectedWarehouseId && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Per-Warehouse Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            {breakdownLoading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Warehouse</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">SKUs</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Total Kits</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Reserved</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Available</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Retail Value</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map(r => (
                    <tr key={r.warehouse_id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{r.warehouse_name} <span className="text-xs text-slate-400">{r.city}</span></td>
                      <td className="px-4 py-2 text-right">{r.skus_count}</td>
                      <td className="px-4 py-2 text-right">{Number(r.total_kits).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-orange-600">{Number(r.reserved_kits).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">{Number(r.available_kits).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${Number(r.retail_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                  {breakdownRows.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-400">No warehouse data</td></tr>}
                </tbody>
              </table></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs — visibility per role access matrix:
          Reorder: admin + sales_rep · Transfers/Activity: admin + warehouse · Payables: admin only */}
      <Tabs defaultValue="inventory">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full max-w-3xl justify-start">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          {seesOps && <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>}
          {(isAdmin || isSalesRep || isLogistics) && <TabsTrigger value="reorder">Reorder</TabsTrigger>}
          <TabsTrigger value="intransit">In-Transit</TabsTrigger>
          {seesOps && <TabsTrigger value="transfers">Transfers</TabsTrigger>}
          {(isAdmin || isLogistics || isWarehouse) && <TabsTrigger value="payables">Payables</TabsTrigger>}
          {seesOps && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <InventoryTab warehouseId={selectedWarehouseId} warehouseList={warehouseList} />
        </TabsContent>
        {seesOps && (
          <TabsContent value="fulfillment" className="mt-4">
            <FulfillmentTab warehouseId={selectedWarehouseId} warehouseList={warehouseList} />
          </TabsContent>
        )}
        {(isAdmin || isSalesRep || isLogistics) && (
          <TabsContent value="reorder" className="mt-4">
            <ReorderTab />
          </TabsContent>
        )}
        <TabsContent value="intransit" className="mt-4">
          <InTransitTab warehouseId={selectedWarehouseId} warehouseList={warehouseList} />
        </TabsContent>
        {seesOps && (
          <TabsContent value="transfers" className="mt-4">
            <TransfersTab warehouseId={selectedWarehouseId} warehouseList={warehouseList} />
          </TabsContent>
        )}
        {(isAdmin || isLogistics || isWarehouse) && (
          <TabsContent value="payables" className="mt-4">
            <PayablesTab />
          </TabsContent>
        )}
        {seesOps && (
          <TabsContent value="activity" className="mt-4">
            <ActivityTab warehouseId={selectedWarehouseId} warehouseList={warehouseList} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
