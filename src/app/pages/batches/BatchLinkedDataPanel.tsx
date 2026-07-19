import React from 'react';
import { rows as asRows } from '@/lib/rows';
import { useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import getBatchOrdersAction from '@/actions/batches/getBatchOrders';
import getBatchWriteoffsAction from '@/actions/batches/getBatchWriteoffs';
import getBatchInboundShipmentsAction from '@/actions/batches/getBatchInboundShipments';
import getBatchTransfersAction from '@/actions/batches/getBatchTransfers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';

export function BatchLinkedDataPanel({ batchId }: { batchId: number }) {
  const navigate = useNavigate();
  const [orders, ordersLoading] = useLoadAction(getBatchOrdersAction, [], { batch_id: batchId });
  const [writeoffs, woLoading] = useLoadAction(getBatchWriteoffsAction, [], { batch_id: batchId });
  const [shipments, shipLoading] = useLoadAction(getBatchInboundShipmentsAction, [], { batch_id: batchId });
  const [transfers, transLoading] = useLoadAction(getBatchTransfersAction, [], { batch_id: batchId });

  type Order = { order_id: number; order_number: string; order_date: string; status: string; customer_name: string; qty_allocated: number };
  type Writeoff = { id: number; quantity: number; reason: string; notes: string; warehouse_name: string; created_at: string; created_by_name: string };
  type Shipment = { shipment_id: number; reference_number: string; status: string; tracking_number: string; arrival_date: string; factory_name: string; destination_warehouse: string; quantity_shipped: number; quantity_received: number };
  type Transfer = { id: number; quantity: number; status: string; source_warehouse_name: string; destination_warehouse_name: string; initiated_at: string; notes: string };

  const orderRows: Order[] = asRows(orders);
  const woRows: Writeoff[] = asRows(writeoffs);
  const shipRows: Shipment[] = asRows(shipments);
  const transRows: Transfer[] = asRows(transfers);

  return (
    <div className="space-y-4">
      {/* Inbound Shipments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Inbound Shipments ({shipRows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {shipLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Reference</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Factory</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Destination</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Shipped</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Received</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Arrival</th>
                </tr>
              </thead>
              <tbody>
                {shipRows.map(s => (
                  <tr key={s.shipment_id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-blue-600">{s.reference_number}</td>
                    <td className="px-4 py-2 text-slate-600">{s.factory_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{s.destination_warehouse || '—'}</td>
                    <td className="px-4 py-2 text-right">{s.quantity_shipped}</td>
                    <td className="px-4 py-2 text-right">{s.quantity_received ?? '—'}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{s.status}</Badge></td>
                    <td className="px-4 py-2 text-slate-600">{s.arrival_date ? new Date(s.arrival_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {shipRows.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-slate-400">No inbound shipments</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {/* Sales Orders */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Consuming Sales Orders ({orderRows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Order #</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Customer</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map(o => (
                  <tr key={o.order_id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate('/orders')}>
                    <td className="px-4 py-2 font-mono text-blue-600">{o.order_number}</td>
                    <td className="px-4 py-2 text-slate-700">{o.customer_name}</td>
                    <td className="px-4 py-2 text-slate-600">{o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-right">{o.qty_allocated}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{o.status}</Badge></td>
                  </tr>
                ))}
                {orderRows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No orders consuming this batch</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {/* Write-offs */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Write-offs ({woRows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {woLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Warehouse</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Reason</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">By</th>
                </tr>
              </thead>
              <tbody>
                {woRows.map(w => (
                  <tr key={w.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-600">{w.warehouse_name || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">{w.quantity}</td>
                    <td className="px-4 py-2 text-slate-600">{w.reason}</td>
                    <td className="px-4 py-2 text-slate-600">{w.created_by_name || '—'}</td>
                  </tr>
                ))}
                {woRows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No write-offs</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {/* Transfers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Inter-Warehouse Transfers ({transRows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">From</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">To</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {transRows.map(t => (
                  <tr key={t.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{new Date(t.initiated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-600">{t.source_warehouse_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{t.destination_warehouse_name || '—'}</td>
                    <td className="px-4 py-2 text-right">{t.quantity}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{t.status}</Badge></td>
                  </tr>
                ))}
                {transRows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No transfers</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
