import React from 'react';
import { useLoadAction } from '@uibakery/data';
import getProductInventoryAction from '@/actions/products/getProductInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type InventoryRow = {
  id: number; quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
  batch_number: string; qc_status: string; manufacture_date: string;
  warehouse_name: string; warehouse_id: number;
};

const QC_STATUS_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  quarantined: 'bg-orange-100 text-orange-700',
};

export function ProductInventoryTab({ productId }: { productId: number }) {
  const [inventory, loading] = useLoadAction(getProductInventoryAction, [], { product_id: productId });
  const rows: InventoryRow[] = Array.isArray(inventory) ? inventory : [];

  const totalOnHand = rows.reduce((s, r) => s + Number(r.quantity_on_hand), 0);
  const totalReserved = rows.reduce((s, r) => s + Number(r.quantity_reserved), 0);
  const totalAvailable = rows.reduce((s, r) => s + Number(r.quantity_available), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Inventory by Batch & Warehouse</CardTitle>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">On Hand: <strong className="text-slate-800">{totalOnHand}</strong></span>
            <span className="text-slate-500">Reserved: <strong className="text-orange-600">{totalReserved}</strong></span>
            <span className="text-slate-500">Available: <strong className="text-green-600">{totalAvailable}</strong></span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Batch #</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Mfg Date</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">QC Status</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Warehouse</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">On Hand</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Reserved</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Available</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={`border-b hover:bg-slate-50 ${r.quantity_available === 0 ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2 font-mono">{r.batch_number}</td>
                  <td className="px-4 py-2 text-slate-600">{r.manufacture_date ? new Date(r.manufacture_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QC_STATUS_COLORS[r.qc_status] || 'bg-slate-100 text-slate-600'}`}>{r.qc_status}</span></td>
                  <td className="px-4 py-2 text-slate-600">{r.warehouse_name}</td>
                  <td className="px-4 py-2 text-right font-medium">{r.quantity_on_hand}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{r.quantity_reserved}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.quantity_available === 0 ? 'text-slate-400' : 'text-green-600'}`}>{r.quantity_available}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">No inventory records</td></tr>}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
