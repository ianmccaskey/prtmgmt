import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import listFulfillmentQueueAction from '@/actions/warehouse/listFulfillmentQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Truck } from 'lucide-react';
import { MarkShippedDialog } from '@/app/pages/warehouse/MarkShippedDialog';
import { OrderDetailDrawer } from '@/app/pages/orders/OrderDetailDrawer';
import { useAppUser } from '@/app/AppContext';

export type QueueItem = {
  order_id: number; order_number: string; status: string; order_date: string;
  partial_fulfillment_allowed: boolean;
  preferred_warehouse_id: number | null; preferred_warehouse_name: string | null;
  ship_to_name: string; ship_address_line1: string; ship_address_line2: string | null;
  ship_city: string; ship_state: string | null; ship_postal_code: string | null; ship_country: string;
  customer_name: string;
  item_id: number; product_id: number; quantity: number; unit_price_usd: string;
  preferred_batch_id: number | null; preferred_batch_number: string | null;
  line_preferred_warehouse_id: number | null; line_preferred_warehouse_name: string | null;
  sku: string; product_name: string;
  allocated_qty: number; stock_available: number; order_reserved_qty: number;
  fulfill_warehouses: string[] | string;
};

export type QueueOrder = {
  order_id: number; order_number: string; status: string; order_date: string;
  partial_fulfillment_allowed: boolean; customer_name: string;
  preferred_warehouse_id: number | null; preferred_warehouse_name: string | null;
  ship_to_name: string; ship_address_line1: string; ship_address_line2: string | null;
  ship_city: string; ship_state: string | null; ship_postal_code: string | null; ship_country: string;
  items: QueueItem[];
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  partially_shipped: 'bg-orange-100 text-orange-700',
};

function parseWarehouses(v: string[] | string): string[] {
  if (Array.isArray(v)) return v;
  // Postgres array literal like {A,B}
  return String(v || '').replace(/^\{|\}$/g, '').split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
}

/** Remaining kits a line still needs to ship. */
export function itemRemaining(it: QueueItem): number {
  return Math.max(0, Number(it.quantity) - Number(it.allocated_qty));
}

/**
 * Gap detection must be PER PRODUCT within an order: stock_available and
 * order_reserved_qty are product-level figures, so two lines of the same
 * product would otherwise each claim the full pool and hide a real shortage.
 * Returns the set of product_ids whose combined remaining exceeds what the
 * order can pull (free stock + its own reservations).
 */
export function gapProducts(o: QueueOrder): Set<number> {
  const byProduct = new Map<number, { remaining: number; shippable: number }>();
  for (const it of o.items) {
    const cur = byProduct.get(it.product_id) || {
      remaining: 0,
      shippable: Number(it.stock_available) + Number(it.order_reserved_qty),
    };
    cur.remaining += itemRemaining(it);
    byProduct.set(it.product_id, cur);
  }
  const gaps = new Set<number>();
  for (const [pid, v] of byProduct) if (v.shippable < v.remaining) gaps.add(pid);
  return gaps;
}

export function FulfillmentTab() {
  const { isLogistics } = useAppUser();
  const [queue, loading, , reload] = useLoadAction(listFulfillmentQueueAction, [], {});
  const rows: QueueItem[] = asRows(queue);
  const [shipOrder, setShipOrder] = useState<QueueOrder | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);

  const orders: QueueOrder[] = [];
  for (const r of rows) {
    let o = orders.find(x => x.order_id === r.order_id);
    if (!o) {
      o = {
        order_id: r.order_id, order_number: r.order_number, status: r.status,
        order_date: r.order_date, partial_fulfillment_allowed: r.partial_fulfillment_allowed,
        preferred_warehouse_id: r.preferred_warehouse_id, preferred_warehouse_name: r.preferred_warehouse_name,
        customer_name: r.customer_name, ship_to_name: r.ship_to_name,
        ship_address_line1: r.ship_address_line1, ship_address_line2: r.ship_address_line2,
        ship_city: r.ship_city, ship_state: r.ship_state, ship_postal_code: r.ship_postal_code,
        ship_country: r.ship_country, items: [],
      };
      orders.push(o);
    }
    o.items.push(r);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-500" /> Fulfillment Queue
            <span className="text-xs font-normal text-slate-400">warehouse-sourced lines awaiting shipment</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Order</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Customer</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Lines to Ship</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Fulfill From</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const gaps = gapProducts(o);
                  const gapItems = o.items.filter(it => gaps.has(it.product_id));
                  const hasGap = gaps.size > 0;
                  const blocked = hasGap && !o.partial_fulfillment_allowed;
                  const totalRemaining = o.items.reduce((s, it) => s + itemRemaining(it), 0);
                  const warehouses = [...new Set(o.items.flatMap(it => parseWarehouses(it.fulfill_warehouses)))];
                  return (
                    <tr key={o.order_id} className={`border-b ${hasGap ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-2">
                        <button className="font-mono font-medium text-blue-600 hover:underline" onClick={() => setDetailOrderId(o.order_id)}>
                          {o.order_number}
                        </button>
                        <div className="text-xs text-slate-400">{new Date(o.order_date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{o.customer_name}</div>
                        <div className="text-xs text-slate-400">{o.ship_city}, {o.ship_country}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="space-y-0.5">
                          {o.items.map(it => {
                            const rem = itemRemaining(it);
                            const gap = gaps.has(it.product_id);
                            const shippable = Number(it.stock_available) + Number(it.order_reserved_qty);
                            return (
                              <div key={it.item_id} className={`text-xs flex items-center gap-1 ${gap ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                {gap && <AlertTriangle className="h-3 w-3" />}
                                {rem}× {it.product_name}
                                {gap && <span className="text-red-400">({shippable} shippable)</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{totalRemaining} kits total</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {warehouses.length > 0 ? warehouses.map(w => <Badge key={w} variant="outline" className="mr-1 text-xs">{w}</Badge>) : <span className="text-red-500">no stock</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}>
                                <Button size="sm" variant={hasGap ? 'outline' : 'default'} className="h-7 text-xs" disabled={blocked || isLogistics} onClick={() => setShipOrder(o)}>
                                  <Truck className="h-3 w-3 mr-1" /> Mark Shipped
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {blocked && (
                              <TooltipContent>
                                <p className="text-xs max-w-56">Insufficient stock for {gapItems.map(g => g.product_name).join(', ')} and this order requires complete fulfillment ("hold until all in stock").</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nothing waiting to ship</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {shipOrder && (
        <MarkShippedDialog
          order={shipOrder}
          onClose={() => setShipOrder(null)}
          onDone={() => { setShipOrder(null); reload(); }}
        />
      )}

      <OrderDetailDrawer
        orderId={detailOrderId}
        open={detailOrderId != null}
        onClose={() => setDetailOrderId(null)}
        onRefresh={reload}
      />
    </div>
  );
}
