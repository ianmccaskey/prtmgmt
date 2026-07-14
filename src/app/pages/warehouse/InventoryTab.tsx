import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import listInventoryAction from '@/actions/warehouse/listInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

type InventoryRow = {
  id: number; sku: string; product_name: string; category: string; list_price: number; low_stock_threshold: number;
  batch_number: string; qc_status: string; manufacture_date: string;
  warehouse_name: string; quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
  in_transit_inbound: number; next_arrival_date: string; product_total_available: number;
};

const QC_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  quarantine: 'bg-orange-100 text-orange-700',
};

const CATEGORIES = ['GLP-1', 'Growth Hormone', 'PT-141', 'BPC-157', 'Research Peptide', 'Other'];

type Props = { warehouseId: string; warehouseList: { id: number; name: string }[] };

export function InventoryTab({ warehouseId, warehouseList }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [qcStatus, setQcStatus] = useState('');

  const [inventory, loading] = useLoadAction(listInventoryAction, [], {
    warehouse_id: warehouseId, search, category, qc_status: qcStatus,
  });
  const rows: InventoryRow[] = Array.isArray(inventory) ? inventory : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap gap-3 items-center">
          <CardTitle className="text-base">Inventory</CardTitle>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search product, SKU, batch…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 h-8"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={qcStatus} onValueChange={setQcStatus}>
            <SelectTrigger className="w-36 h-8"><SelectValue placeholder="All QC" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All QC</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="quarantine">Quarantined</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Batch</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Warehouse</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">QC</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">On Hand</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Reserved</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Available</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">In-Transit</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Next Arrival</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isLowStock = Number(r.product_total_available) <= Number(r.low_stock_threshold);
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 ${isLowStock ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{r.product_name}</div>
                        <div className="text-xs text-slate-400">{r.sku}</div>
                        {isLowStock && <Badge className="text-xs bg-red-100 text-red-700 mt-0.5">Low Stock</Badge>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.batch_number}</td>
                      <td className="px-3 py-2 text-slate-600">{r.warehouse_name}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${QC_COLORS[r.qc_status] || 'bg-slate-100 text-slate-600'}`}>{r.qc_status}</span></td>
                      <td className="px-3 py-2 text-right">{r.quantity_on_hand}</td>
                      <td className="px-3 py-2 text-right text-orange-600">{r.quantity_reserved}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.quantity_available === 0 ? 'text-slate-400' : 'text-green-600'}`}>{r.quantity_available}</td>
                      <td className="px-3 py-2 text-right text-purple-600">{r.in_transit_inbound > 0 ? r.in_transit_inbound : '—'}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{r.next_arrival_date ? new Date(r.next_arrival_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No inventory records</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
