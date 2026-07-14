import React from 'react';
import { useLoadAction } from '@uibakery/data';
import listInTransitInboundAction from '@/actions/warehouse/listInTransitInbound';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type InTransitRow = {
  id: number; shipment_id: number; quantity_shipped: number; quantity_received: number;
  expected_arrival_date: string; condition_flag: string;
  sku: string; product_name: string; batch_number: string;
  destination_warehouse: string; reference_number: string; shipment_status: string; arrival_date: string;
};

type Props = { warehouseId: string; warehouseList: { id: number; name: string }[] };

export function InTransitTab({ warehouseId }: Props) {
  const [items, loading] = useLoadAction(listInTransitInboundAction, [], { warehouse_id: warehouseId });
  const rows: InTransitRow[] = Array.isArray(items) ? items : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">In-Transit Inbound ({rows.length} lines)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Product</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Batch</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Destination</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Shipment Ref</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty Shipped</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty Received</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Expected Arrival</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-slate-400">{r.sku}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.batch_number || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.destination_warehouse || '—'}</td>
                    <td className="px-4 py-2 font-mono text-blue-600">{r.reference_number}</td>
                    <td className="px-4 py-2 text-right">{r.quantity_shipped}</td>
                    <td className="px-4 py-2 text-right text-green-600">{r.quantity_received ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{r.expected_arrival_date ? new Date(r.expected_arrival_date).toLocaleDateString() : r.arrival_date ? new Date(r.arrival_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{r.shipment_status}</Badge></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No in-transit inbound items</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
