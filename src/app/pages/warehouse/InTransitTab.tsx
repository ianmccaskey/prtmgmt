import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listInTransitInboundAction from '@/actions/warehouse/listInTransitInbound';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { ReceiveShipmentDialog } from '@/app/pages/logistics/ReceiveShipmentDialog';

type InTransitRow = {
  id: number; shipment_id: number; product_id: number; batch_id: number;
  destination_warehouse_id: number; destination_warehouse_name: string;
  quantity_shipped: number; quantity_received: number | null;
  expected_arrival_date: string; condition_flag: string;
  sku: string; product_name: string; batch_number: string;
  destination_warehouse: string; reference_number: string; shipment_status: string; arrival_date: string;
};

type Props = { warehouseId: string; warehouseList: { id: number; name: string }[] };

export function InTransitTab({ warehouseId }: Props) {
  const { isAdmin, isWarehouse } = useAppUser();
  const [items, loading, , reload] = useLoadAction(listInTransitInboundAction, [warehouseId], { warehouse_id: warehouseId });
  const rows: InTransitRow[] = asRows(items);
  // Receiving happens HERE, at the destination warehouse (not in Logistics):
  // warehouse users receive their own inbound lines; admins can too.
  const canReceive = isAdmin || isWarehouse;
  const [receiveShipmentId, setReceiveShipmentId] = useState<number | null>(null);

  const receivableFor = (shipmentId: number) =>
    rows.filter(r => r.shipment_id === shipmentId && (r.quantity_received === null || r.quantity_received === undefined));

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
                  {canReceive && <th className="text-right px-4 py-2 font-medium text-slate-600">Actions</th>}
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
                    {canReceive && (
                      <td className="px-4 py-2 text-right">
                        {(r.quantity_received === null || r.quantity_received === undefined) && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => setReceiveShipmentId(r.shipment_id)}>
                            <Package className="h-3 w-3 mr-1" /> Receive
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={canReceive ? 9 : 8} className="text-center py-8 text-slate-400">No in-transit inbound items</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {receiveShipmentId != null && (
        <ReceiveShipmentDialog
          open
          onClose={() => { setReceiveShipmentId(null); reload(); }}
          shipmentId={receiveShipmentId}
          items={receivableFor(receiveShipmentId)}
          onDone={() => { setReceiveShipmentId(null); reload(); }}
        />
      )}
    </Card>
  );
}
