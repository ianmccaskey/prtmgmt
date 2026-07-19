import React, { useEffect, useMemo, useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getFifoStockAction from '@/actions/warehouse/getFifoStock';
import getActiveRatePlanAction from '@/actions/warehouse/getActiveRatePlan';
import createOutboundShipmentAction from '@/actions/warehouse/createOutboundShipment';
import shipAllocationAtomicAction from '@/actions/warehouse/shipAllocationAtomic';
import markOrderShippedFromWarehouseAction from '@/actions/warehouse/markOrderShippedFromWarehouse';
import createShipmentNotificationAction from '@/actions/orders/createShipmentNotification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Truck } from 'lucide-react';
import { calcShippingCost, RatePlan } from '@/lib/shippingCost';
import { QueueOrder, itemRemaining } from '@/app/pages/warehouse/FulfillmentTab';

type FifoRow = {
  inventory_id: number; product_id: number; batch_id: number; warehouse_id: number;
  quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
  order_reserved: number; batch_number: string; manufacture_date: string; warehouse_name: string;
};

type AllocRow = {
  key: string;
  item_id: number;
  product_id: number;
  inventory_id: number | null;
  qty: number;
};

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'other'];

/** Kits this order can pull from a row: free stock + its own ledgered reservation. */
function rowUsable(r: FifoRow): number {
  return Math.max(0, Number(r.quantity_available)) + Number(r.order_reserved);
}

/** Full ship-to address with one-click copy, label-formatted. */
function ShipToBlock({ order }: { order: QueueOrder }) {
  const [copied, setCopied] = useState(false);
  const lines = [
    order.ship_to_name || order.customer_name,
    order.ship_address_line1,
    order.ship_address_line2,
    [order.ship_city, order.ship_state, dbText(order.ship_postal_code)].filter(Boolean).join(', '),
    order.ship_country,
  ].filter((l): l is string => !!l && String(l).trim() !== '');
  const copy = () => {
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg border bg-slate-50 p-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Ship To</p>
        {lines.map((l, i) => (
          <p key={i} className={`text-sm ${i === 0 ? 'font-medium' : 'text-slate-600'}`}>{l}</p>
        ))}
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={copy}>
        {copied ? 'Copied' : 'Copy address'}
      </Button>
    </div>
  );
}

export function MarkShippedDialog({ order, onClose, onDone }: {
  order: QueueOrder; onClose: () => void; onDone: () => void;
}) {
  const { profileId, isWarehouse, assignedWarehouseId } = useAppUser();
  const [stockRaw, stockLoading] = useLoadAction(getFifoStockAction, [order.order_id], { order_id: order.order_id });
  const [planRaw, planLoading] = useLoadAction(getActiveRatePlanAction, [], {});

  const [createShipment] = useMutateAction(createOutboundShipmentAction);
  const [shipAllocation] = useMutateAction(shipAllocationAtomicAction);
  const [markShipped] = useMutateAction(markOrderShippedFromWarehouseAction);
  const [createNotification] = useMutateAction(createShipmentNotificationAction);

  // Warehouse users only allocate from their own warehouse (access matrix).
  const stock: FifoRow[] = useMemo(() => {
    const all = asRows<FifoRow>(stockRaw);
    return isWarehouse ? all.filter(r => r.warehouse_id === assignedWarehouseId) : all;
  }, [stockRaw, isWarehouse, assignedWarehouseId]);

  const plan: RatePlan | null = Array.isArray(planRaw) && planRaw.length > 0 ? (planRaw[0] as RatePlan) : null;

  const [allocs, setAllocs] = useState<AllocRow[]>([]);
  const [carriers, setCarriers] = useState<Record<number, string>>({});
  const [trackings, setTrackings] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Default allocation, per line: rows of the line's pinned batch first,
  // then rows holding this order's reservations, then the rest FIFO
  // oldest-batch first (stable sort keeps FIFO order within each tier).
  // Pinned lines are processed first so an unpinned sibling line of the
  // same product can't claim the pinned batch's rows before them.
  useEffect(() => {
    if (stockLoading || allocs.length > 0) return;
    const next: AllocRow[] = [];
    const usedByRow: Record<number, number> = {};
    const itemsOrdered = [...order.items].sort((a, b) => (b.preferred_batch_id != null ? 1 : 0) - (a.preferred_batch_id != null ? 1 : 0));
    for (const it of itemsOrdered) {
      let remaining = itemRemaining(it);
      // Own reservations outrank an unreserved pinned-batch row: shipping
      // must consume this order's ledger rows first or they'd be stranded
      // (ship consumes ledger only for the inventory rows it ships from).
      // A reserved pinned row still ranks highest (4+2). The warehouse
      // preference is per line (split shipments) falling back to the order's.
      const prefWh = it.line_preferred_warehouse_id ?? order.preferred_warehouse_id;
      const score = (r: FifoRow) =>
        (Number(r.order_reserved) > 0 ? 4 : 0) +
        (it.preferred_batch_id != null && r.batch_id === it.preferred_batch_id ? 2 : 0) +
        (prefWh != null && r.warehouse_id === prefWh ? 1 : 0);
      const candidates = stock
        .filter(s => s.product_id === it.product_id)
        .slice()
        .sort((a, b) => score(b) - score(a));
      for (const r of candidates) {
        if (remaining <= 0) break;
        const usable = rowUsable(r) - (usedByRow[r.inventory_id] || 0);
        if (usable <= 0) continue;
        const take = Math.min(remaining, usable);
        next.push({ key: `${it.item_id}-${r.inventory_id}`, item_id: it.item_id, product_id: it.product_id, inventory_id: r.inventory_id, qty: take });
        usedByRow[r.inventory_id] = (usedByRow[r.inventory_id] || 0) + take;
        remaining -= take;
      }
    }
    setAllocs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockLoading, stock]);

  const rowFor = (id: number | null) => stock.find(s => s.inventory_id === id);

  // Validation
  const usedPerRow: Record<number, number> = {};
  for (const a of allocs) {
    if (a.inventory_id != null) usedPerRow[a.inventory_id] = (usedPerRow[a.inventory_id] || 0) + a.qty;
  }
  const problems: string[] = [];
  // Rows with a quantity but no batch/warehouse picked must not count toward
  // line coverage (they never ship) — force the user to resolve them.
  if (allocs.some(a => a.qty > 0 && a.inventory_id == null)) {
    problems.push('Every allocation row with a quantity needs a batch/warehouse selected (or remove the row).');
  }
  for (const it of order.items) {
    const lineTotal = allocs.filter(a => a.item_id === it.item_id && a.inventory_id != null).reduce((s, a) => s + a.qty, 0);
    const rem = itemRemaining(it);
    if (lineTotal > rem) problems.push(`${it.product_name}: allocated ${lineTotal} exceeds the ${rem} remaining.`);
    if (lineTotal < rem && !order.partial_fulfillment_allowed) problems.push(`${it.product_name}: only ${lineTotal}/${rem} allocated and this order requires complete fulfillment.`);
  }
  for (const [invId, used] of Object.entries(usedPerRow)) {
    const r = rowFor(Number(invId));
    if (r && used > rowUsable(r)) problems.push(`${r.batch_number} @ ${r.warehouse_name}: ${used} allocated but only ${rowUsable(r)} shippable.`);
  }

  // Shipments preview grouped by warehouse
  const shipmentGroups = useMemo(() => {
    const groups: Record<number, { warehouse_id: number; warehouse_name: string; kits: number; allocs: AllocRow[] }> = {};
    for (const a of allocs) {
      const r = rowFor(a.inventory_id);
      if (!r || a.qty <= 0) continue;
      if (!groups[r.warehouse_id]) groups[r.warehouse_id] = { warehouse_id: r.warehouse_id, warehouse_name: r.warehouse_name, kits: 0, allocs: [] };
      groups[r.warehouse_id].kits += a.qty;
      groups[r.warehouse_id].allocs.push(a);
    }
    return Object.values(groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocs, stock]);

  const missingShipInfo = shipmentGroups.some(g => !carriers[g.warehouse_id] || !(trackings[g.warehouse_id] || '').trim());
  const nothingAllocated = shipmentGroups.length === 0;
  const canConfirm = !saving && !planLoading && !!plan && problems.length === 0 && !nothingAllocated && !missingShipInfo;

  const upAlloc = (key: string, patch: Partial<AllocRow>) => setAllocs(prev => prev.map(a => a.key === key ? { ...a, ...patch } : a));
  const rmAlloc = (key: string) => setAllocs(prev => prev.filter(a => a.key !== key));
  const addAlloc = (it: { item_id: number; product_id: number }) =>
    setAllocs(prev => [...prev, { key: `${it.item_id}-new-${prev.length}-${prev.reduce((s, a) => s + a.qty, 0)}`, item_id: it.item_id, product_id: it.product_id, inventory_id: null, qty: 0 }]);

  const confirm = async () => {
    if (!canConfirm || !plan) return;
    setSaving(true);
    setError('');
    try {
      for (const g of shipmentGroups) {
        const cost = calcShippingCost(plan, g.kits);
        const res = await createShipment({
          order_id: order.order_id,
          warehouse_id: g.warehouse_id,
          carrier: carriers[g.warehouse_id],
          tracking_number: trackings[g.warehouse_id].trim(),
          cost_usd: cost,
          rate_plan_id: plan.id,
        }) as { id: number }[];
        const shipmentId = res?.[0]?.id;
        if (!shipmentId) throw new Error(`Failed to create shipment for ${g.warehouse_name}`);
        for (const a of g.allocs) {
          const r = rowFor(a.inventory_id)!;
          // Single atomic statement: allocation + shipment item + ledger
          // consumption + inventory decrement + activity log.
          await shipAllocation({
            order_id: order.order_id, item_id: a.item_id, inventory_id: r.inventory_id,
            batch_id: r.batch_id, warehouse_id: r.warehouse_id, product_id: a.product_id,
            quantity: a.qty, user_id: profileId, shipment_id: shipmentId,
            notes: `Picked for ${order.order_number} (batch ${r.batch_number})`,
          });
        }
        await createNotification({ shipment_id: shipmentId });
      }
      await markShipped({ order_id: order.order_id });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Shipping failed — some steps may have completed. Reload and re-run; remaining lines stay in the queue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && !saving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Truck className="h-4 w-4" /> Mark Shipped — {order.order_number}
            {order.preferred_warehouse_name && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-600 border-blue-200 font-normal">
                Fulfills from {order.preferred_warehouse_name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {stockLoading || planLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-5">
            {/* Ship-to address — everything needed for a shipping label */}
            <ShipToBlock order={order} />
            {!plan && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-3">
                No active shipping rate plan exists — add one under Settings → Rate Plans before shipping.
              </p>
            )}

            {/* Per-line allocation editor */}
            <div className="space-y-4">
              {order.items.map(it => {
                const lineAllocs = allocs.filter(a => a.item_id === it.item_id);
                const lineTotal = lineAllocs.reduce((s, a) => s + a.qty, 0);
                const rem = itemRemaining(it);
                const productRows = stock.filter(s => s.product_id === it.product_id);
                return (
                  <div key={it.item_id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{it.product_name}</span>
                        <span className="ml-2 text-xs text-slate-400 font-mono">{it.sku}</span>
                        {it.preferred_batch_number && (
                          <Badge variant="outline" className="ml-2 text-xs px-1 py-0 text-teal-600 border-teal-200">
                            Batch {it.preferred_batch_number} requested
                          </Badge>
                        )}
                        {it.line_preferred_warehouse_name && (
                          <Badge variant="outline" className="ml-2 text-xs px-1 py-0 text-indigo-600 border-indigo-200">
                            → {it.line_preferred_warehouse_name}
                          </Badge>
                        )}
                      </div>
                      <Badge variant={lineTotal === rem ? 'secondary' : 'outline'} className={lineTotal < rem ? 'text-amber-600 border-amber-300' : ''}>
                        {lineTotal}/{rem} kits allocated{lineTotal < rem ? ' — backorder' : ''}
                      </Badge>
                    </div>
                    {lineAllocs.map(a => {
                      const r = rowFor(a.inventory_id);
                      return (
                        <div key={a.key} className="flex items-center gap-2 mb-1.5">
                          <Select value={a.inventory_id != null ? String(a.inventory_id) : ''} onValueChange={v => upAlloc(a.key, { inventory_id: Number(v) })}>
                            <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Pick batch / warehouse…" /></SelectTrigger>
                            <SelectContent>
                              {productRows.map(s => (
                                <SelectItem key={s.inventory_id} value={String(s.inventory_id)}>
                                  {s.batch_number} · {s.warehouse_name} ({rowUsable(s)} shippable{s.order_reserved > 0 ? `, ${s.order_reserved} reserved for this order` : ''})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number" min={0} max={r ? rowUsable(r) : undefined}
                            className="w-24 h-8 text-xs"
                            value={a.qty || ''}
                            onChange={e => upAlloc(a.key, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => rmAlloc(a.key)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      );
                    })}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600" onClick={() => addAlloc(it)} disabled={productRows.length === 0}>
                      <Plus className="h-3 w-3 mr-1" /> Split across another batch/warehouse
                    </Button>
                    {productRows.length === 0 && <p className="text-xs text-red-500 mt-1">No passed-QC stock anywhere for this product.</p>}
                  </div>
                );
              })}
            </div>

            {/* Shipment preview per warehouse */}
            {shipmentGroups.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  {shipmentGroups.length} shipment{shipmentGroups.length > 1 ? 's' : ''} will be created (one per warehouse)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {shipmentGroups.map(g => (
                    <div key={g.warehouse_id} className="border rounded-lg p-3 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{g.warehouse_name}</span>
                        <span className="text-xs text-slate-500">{g.kits} kits · internal cost ${plan ? calcShippingCost(plan, g.kits).toFixed(2) : '—'}</span>
                      </div>
                      <div>
                        <Label className="text-xs">Carrier *</Label>
                        <Select value={carriers[g.warehouse_id] || ''} onValueChange={v => setCarriers(c => ({ ...c, [g.warehouse_id]: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select carrier…" /></SelectTrigger>
                          <SelectContent>{CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tracking Number *</Label>
                        <Input className="h-8 text-xs" value={trackings[g.warehouse_id] || ''} onChange={e => setTrackings(t => ({ ...t, [g.warehouse_id]: e.target.value }))} placeholder="Tracking #" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {problems.length > 0 && (
              <ul className="text-xs text-red-600 bg-red-50 rounded p-3 space-y-1">
                {problems.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm}>
            {saving ? 'Shipping…' : `Confirm & Create ${shipmentGroups.length || ''} Shipment${shipmentGroups.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
