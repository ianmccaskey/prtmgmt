import React from 'react';
import { useLoadAction } from '@uibakery/data';
import getBatchInventoryAction from '@/actions/batches/getBatchInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type InventoryRow = {
  id: number; warehouse_name: string; warehouse_id: number;
  quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
};

export function BatchInventoryPanel({ batchId }: { batchId: number }) {
  const [inventory, loading] = useLoadAction(getBatchInventoryAction, [], { batch_id: batchId });
  const rows: InventoryRow[] = Array.isArray(inventory) ? inventory : [];
  const totOnHand = rows.reduce((s, r) => s + Number(r.quantity_on_hand), 0);
  const totReserved = rows.reduce((s, r) => s + Number(r.quantity_reserved), 0);
  const totAvailable = rows.reduce((s, r) => s + Number(r.quantity_available), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Inventory by Warehouse</CardTitle>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">On Hand: <strong>{totOnHand}</strong></span>
            <span className="text-slate-500">Reserved: <strong className="text-orange-600">{totReserved}</strong></span>
            <span className="text-slate-500">Available: <strong className="text-green-600">{totAvailable}</strong></span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Warehouse</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">On Hand</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Reserved</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Available</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">{r.warehouse_name}</td>
                  <td className="px-4 py-2 text-right">{r.quantity_on_hand}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{r.quantity_reserved}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.quantity_available === 0 ? 'text-slate-400' : 'text-green-600'}`}>{r.quantity_available}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">No inventory for this batch</td></tr>}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
