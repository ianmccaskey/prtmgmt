import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, PaymentBadge } from './OrderBadges';
import { Truck } from 'lucide-react';
import getChinaDirectQueue from '@/actions/orders/getChinaDirectQueue';
import getChinaDirectStats from '@/actions/orders/getChinaDirectStats';
import markShippedFromChina from '@/actions/orders/markShippedFromChina';

type ChinaOrder = {
  id: number; order_number: string; order_date: string; status: string;
  payment_status: string; total_usd: string; customer_name: string;
  days_waiting: number; has_warehouse_lines: boolean; factory_name: string;
};

type Stats = { awaiting_shipment: string; shipped_china_this_month: string };

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-4 py-2 border-r border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value ?? '0'}</span>
    </div>
  );
}

function ShipFromChinaDialog({ order, open, onClose, onDone }: { order: ChinaOrder | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [shipDate, setShipDate] = useState(new Date().toISOString().split('T')[0]);
  const [doShip, shipping] = useMutateAction(markShippedFromChina);

  const submit = async () => {
    if (!order) return;
    await doShip({ orderId: order.id, factoryId: null, carrier, trackingNumber: tracking, shippedDate: shipDate });
    onDone(); onClose();
    setCarrier(''); setTracking(''); setShipDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Mark Shipped from China</DialogTitle></DialogHeader>
        {order && <p className="text-sm text-muted-foreground mb-2">Order: <span className="font-medium">{order.order_number}</span> · {order.customer_name}</p>}
        <div className="space-y-3 py-2">
          <div><Label>Carrier</Label><Input placeholder="e.g. DHL, EMS, 4PX" value={carrier} onChange={e => setCarrier(e.target.value)} /></div>
          <div><Label>Tracking Number</Label><Input value={tracking} onChange={e => setTracking(e.target.value)} /></div>
          <div><Label>Ship Date</Label><Input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={shipping || !carrier || !tracking}><Truck className="h-4 w-4 mr-1" /> Mark Shipped</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChinaDirectTab() {
  const [queue, loading, , reload] = useLoadAction(getChinaDirectQueue, []);
  const [stats] = useLoadAction(getChinaDirectStats, []);
  const [shipOpen, setShipOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ChinaOrder | null>(null);

  const statRow = (stats as Stats[])[0];

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="flex flex-wrap items-center bg-muted/30 border border-border/60 rounded-lg">
        <StatChip label="Awaiting Shipment" value={statRow?.awaiting_shipment ?? '0'} />
        <StatChip label="Shipped China (Month)" value={statRow?.shipped_china_this_month ?? '0'} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Order #</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Factory</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Wait (days)</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Payment</th>
                <th className="text-left p-3 font-medium">Mix</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={9} className="p-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : (queue as ChinaOrder[]).length === 0 ? (
                <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">No orders in the China-Direct queue</td></tr>
              ) : (
                asRows<ChinaOrder>(queue).map(order => (
                  <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-medium">{order.order_number}</td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{order.factory_name || '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`font-medium ${Number(order.days_waiting) > 14 ? 'text-red-600' : Number(order.days_waiting) > 7 ? 'text-amber-600' : 'text-foreground'}`}>
                        {order.days_waiting}
                      </span>
                    </td>
                    <td className="p-3"><StatusBadge status={order.status} /></td>
                    <td className="p-3"><PaymentBadge status={order.payment_status} /></td>
                    <td className="p-3">
                      {order.has_warehouse_lines ? (
                        <Badge variant="outline" className="text-xs px-1 py-0 bg-orange-50 text-orange-600 border-orange-200">Mixed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">All CN</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {order.status === 'confirmed' && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => { setSelectedOrder(order); setShipOpen(true); }}>
                            <Truck className="h-3 w-3 mr-1" /> Ship
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShipFromChinaDialog order={selectedOrder} open={shipOpen} onClose={() => { setShipOpen(false); setSelectedOrder(null); }} onDone={reload} />
    </div>
  );
}
