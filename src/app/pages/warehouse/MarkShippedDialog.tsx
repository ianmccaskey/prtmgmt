import React, { useEffect, useMemo, useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getFifoStockAction from '@/actions/warehouse/getFifoStock';
import getActiveRatePlanAction from '@/actions/warehouse/getActiveRatePlan';
import listWarehouseShipFromAction from '@/actions/warehouse/listWarehouseShipFrom';
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
import { ExternalLink, Plus, Trash2, Truck } from 'lucide-react';
import { calcShippingCost, RatePlan } from '@/lib/shippingCost';
import { QueueOrder, itemRemaining } from '@/app/pages/warehouse/FulfillmentTab';
import {
  ShippoAddress, ShippoRate, getShippoRates, buyShippoLabel, providerToCarrier, toIsoCountry,
} from '@/lib/shippo';

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

type ShipFromRow = {
  id: number; name: string; ship_from_name: string | null;
  address_line1: string | null; address_line2: string | null;
  city: string | null; state: string | null; postal_code: string | null; country: string | null;
  ship_from_phone: string | null; shippo_api_key: string | null;
};

export type PurchasedLabel = {
  label_url: string; transaction_id: string; cost: number; tracking_number: string;
  /** Kits in the shipment group at purchase time — drift afterwards gets flagged. */
  kits: number;
};

/**
 * Quote & purchase a Shippo label for one shipment group, on the origin
 * warehouse's own Shippo account. Quoting state is local; the purchased
 * label is lifted to the dialog so Confirm records it on the shipment.
 */
function ShippoSection({ wh, order, onPurchased }: {
  wh: ShipFromRow; order: QueueOrder; onPurchased: (carrier: string, label: Omit<PurchasedLabel, 'kits'>) => void;
}) {
  const [parcel, setParcel] = useState({ length: '10', width: '8', height: '6', weight: '' });
  const [rates, setRates] = useState<ShippoRate[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [selRate, setSelRate] = useState('');
  const [busy, setBusy] = useState<'quote' | 'buy' | null>(null);
  const [err, setErr] = useState('');

  const addressOk = !!(wh.address_line1 && wh.city && dbText(wh.postal_code));
  const parcelOk = ['length', 'width', 'height', 'weight'].every(k => Number(parcel[k as keyof typeof parcel]) > 0);
  const shipToOk = !!(order.ship_address_line1 && order.ship_city && dbText(order.ship_postal_code));

  const quote = async () => {
    if (!wh.shippo_api_key) return;
    setBusy('quote'); setErr(''); setRates([]); setSelRate(''); setMessages([]);
    try {
      const from: ShippoAddress = {
        name: wh.ship_from_name || wh.name,
        street1: wh.address_line1 || '',
        street2: wh.address_line2 || undefined,
        city: wh.city || '',
        state: wh.state || undefined,
        zip: dbText(wh.postal_code),
        country: toIsoCountry(wh.country),
        phone: wh.ship_from_phone || undefined,
      };
      const to: ShippoAddress = {
        name: order.ship_to_name || order.customer_name,
        street1: order.ship_address_line1,
        street2: order.ship_address_line2 || undefined,
        city: order.ship_city,
        state: order.ship_state || undefined,
        zip: dbText(order.ship_postal_code),
        country: toIsoCountry(order.ship_country),
      };
      const res = await getShippoRates(wh.shippo_api_key, from, to, {
        length: parcel.length, width: parcel.width, height: parcel.height,
        distance_unit: 'in', weight: parcel.weight, mass_unit: 'lb',
      });
      setRates(res.rates);
      setMessages(res.messages);
      if (res.rates.length > 0) setSelRate(res.rates[0].object_id);
      else setErr(res.messages.length ? '' : 'Shippo returned no rates — check the addresses and parcel size.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to get rates');
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    const rate = rates.find(r => r.object_id === selRate);
    if (!wh.shippo_api_key || !rate) return;
    setBusy('buy'); setErr('');
    try {
      const label = await buyShippoLabel(wh.shippo_api_key, rate.object_id);
      onPurchased(providerToCarrier(rate.provider), {
        label_url: label.label_url,
        transaction_id: label.object_id,
        cost: Number(rate.amount),
        tracking_number: label.tracking_number,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Label purchase failed');
    } finally {
      setBusy(null);
    }
  };

  const selected = rates.find(r => r.object_id === selRate);

  return (
    <div className="border-t pt-2 space-y-2">
      <p className="text-xs font-medium text-slate-600">Shippo label</p>
      {!addressOk && (
        <p className="text-xs text-amber-700">
          Ship-from address is incomplete — fill it in under Settings → Warehouses to quote rates.
        </p>
      )}
      {!shipToOk && <p className="text-xs text-amber-700">The order&apos;s ship-to address is incomplete.</p>}
      <div className="grid grid-cols-4 gap-1.5">
        {([['length', 'L (in)'], ['width', 'W (in)'], ['height', 'H (in)'], ['weight', 'Wt (lb)']] as const).map(([k, lbl]) => (
          <div key={k}>
            <Label className="text-[10px] text-slate-500">{lbl}</Label>
            <Input
              type="number" min={0} step="0.1" className="h-7 text-xs"
              value={parcel[k]}
              onChange={e => setParcel(p => ({ ...p, [k]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button
        size="sm" variant="outline" className="h-7 text-xs w-full"
        disabled={busy !== null || !addressOk || !parcelOk || !shipToOk}
        onClick={quote}
      >
        {busy === 'quote' ? 'Getting rates…' : rates.length > 0 ? 'Re-quote rates' : 'Get rates'}
      </Button>
      {messages.length > 0 && (
        <ul className="text-[11px] text-amber-700 bg-amber-50 rounded p-2 space-y-0.5">
          {messages.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      {rates.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {rates.map(r => (
            <label key={r.object_id} className={`flex items-center gap-2 text-xs rounded border px-2 py-1.5 cursor-pointer ${selRate === r.object_id ? 'border-blue-400 bg-blue-50' : 'bg-white'}`}>
              <input
                type="radio" name={`shippo-rate-${wh.id}`}
                checked={selRate === r.object_id}
                onChange={() => setSelRate(r.object_id)}
              />
              <span className="flex-1">
                <span className="font-medium">{r.provider}</span> {r.servicelevel?.name}
                {r.estimated_days != null && <span className="text-slate-400"> · ~{r.estimated_days}d</span>}
              </span>
              <span className="font-semibold">${Number(r.amount).toFixed(2)}</span>
            </label>
          ))}
        </div>
      )}
      {selected && (
        <Button size="sm" className="h-7 text-xs w-full" disabled={busy !== null} onClick={buy}>
          {busy === 'buy' ? 'Purchasing…' : `Buy label — $${Number(selected.amount).toFixed(2)} (${selected.provider})`}
        </Button>
      )}
      {err && <p className="text-[11px] text-red-600 bg-red-50 rounded p-2">{err}</p>}
    </div>
  );
}

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
  // Warehouse users only receive their own warehouse's Shippo key.
  const shipFromScope = isWarehouse && assignedWarehouseId ? String(assignedWarehouseId) : '';
  const [shipFromRaw] = useLoadAction(listWarehouseShipFromAction, [shipFromScope], { warehouse_id: shipFromScope });

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
  // Labels purchased via Shippo this session, keyed by warehouse — recorded
  // on the shipment row at Confirm.
  const [labels, setLabels] = useState<Record<number, PurchasedLabel>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const shipFroms = useMemo(() => asRows<ShipFromRow>(shipFromRaw), [shipFromRaw]);
  const shipFromFor = (whId: number) => shipFroms.find(w => Number(w.id) === whId);

  // A purchased label already cost real money — closing without confirming
  // would leave it unrecorded, so double-check the intent.
  const guardedClose = () => {
    if (saving) return;
    if (Object.keys(labels).length > 0 && !saved &&
        !window.confirm('A shipping label was already purchased but the shipment is not recorded yet. Close anyway? (The label stays valid on Shippo, but the app will have no record of it.)')) {
      return;
    }
    onClose();
  };

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

  // A purchased label whose warehouse no longer ships anything would silently
  // vanish from the record — block until the allocation is restored or the
  // label reference is explicitly discarded.
  const orphanLabelWhIds = Object.keys(labels).map(Number).filter(whId => !shipmentGroups.some(g => g.warehouse_id === whId));
  for (const whId of orphanLabelWhIds) {
    const whName = shipFromFor(whId)?.name || `warehouse #${whId}`;
    problems.push(`A Shippo label was purchased for ${whName} but nothing ships from it anymore — restore that allocation or discard the label reference below.`);
  }

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
        const label = labels[g.warehouse_id];
        const res = await createShipment({
          order_id: order.order_id,
          warehouse_id: g.warehouse_id,
          carrier: carriers[g.warehouse_id],
          tracking_number: trackings[g.warehouse_id].trim(),
          cost_usd: cost,
          rate_plan_id: plan.id,
          label_url: label?.label_url ?? null,
          shippo_transaction_id: label?.transaction_id ?? null,
          label_cost_usd: label?.cost ?? null,
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
      setSaved(true);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Shipping failed — some steps may have completed. Reload and re-run; remaining lines stay in the queue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && guardedClose()}>
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
                        <Select value={carriers[g.warehouse_id] || ''} onValueChange={v => setCarriers(c => ({ ...c, [g.warehouse_id]: v }))} disabled={!!labels[g.warehouse_id]}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select carrier…" /></SelectTrigger>
                          <SelectContent>{CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tracking Number *</Label>
                        <Input className="h-8 text-xs" value={trackings[g.warehouse_id] || ''} onChange={e => setTrackings(t => ({ ...t, [g.warehouse_id]: e.target.value }))} placeholder="Tracking #" disabled={!!labels[g.warehouse_id]} />
                      </div>
                      {labels[g.warehouse_id] ? (
                        <div className="border-t pt-2 text-xs bg-green-50 -mx-3 -mb-3 px-3 pb-3 rounded-b-lg space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-green-700">
                              Label purchased — ${labels[g.warehouse_id].cost.toFixed(2)}
                            </p>
                            <Button
                              size="sm" variant="ghost" className="h-6 text-xs text-red-500 shrink-0"
                              onClick={() => setLabels(l => { const n = { ...l }; delete n[g.warehouse_id]; return n; })}
                            >
                              Unlink label
                            </Button>
                          </div>
                          <p className="text-green-700 font-mono break-all">{labels[g.warehouse_id].tracking_number}</p>
                          <a
                            href={labels[g.warehouse_id].label_url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Open label (PDF)
                          </a>
                          {labels[g.warehouse_id].kits !== g.kits && (
                            <p className="text-amber-700">
                              Allocation changed since purchase ({labels[g.warehouse_id].kits} → {g.kits} kits) — verify the
                              parcel and postage still fit, or unlink and re-quote.
                            </p>
                          )}
                          <p className="text-green-800/70">Recorded on the shipment when you confirm below.</p>
                        </div>
                      ) : (() => {
                        const wh = shipFromFor(g.warehouse_id);
                        return wh?.shippo_api_key ? (
                          <ShippoSection
                            wh={wh} order={order}
                            onPurchased={(carrier, label) => {
                              setLabels(l => ({ ...l, [g.warehouse_id]: { ...label, kits: g.kits } }));
                              setCarriers(c => ({ ...c, [g.warehouse_id]: carrier }));
                              setTrackings(t => ({ ...t, [g.warehouse_id]: label.tracking_number }));
                            }}
                          />
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {orphanLabelWhIds.map(whId => (
              <div key={whId} className="text-xs text-amber-700 bg-amber-50 rounded p-3 flex items-start justify-between gap-3">
                <span>
                  Label purchased for <span className="font-medium">{shipFromFor(whId)?.name || `warehouse #${whId}`}</span> (tracking{' '}
                  <span className="font-mono">{labels[whId].tracking_number}</span>) but nothing ships from it anymore.
                  Discarding only removes the app&apos;s reference — void the label itself on Shippo to get refunded.
                </span>
                <Button
                  size="sm" variant="outline" className="h-7 text-xs shrink-0"
                  onClick={() => setLabels(l => { const n = { ...l }; delete n[whId]; return n; })}
                >
                  Discard label reference
                </Button>
              </div>
            ))}
            {problems.length > 0 && (
              <ul className="text-xs text-red-600 bg-red-50 rounded p-3 space-y-1">
                {problems.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={guardedClose} disabled={saving}>Cancel</Button>
          <Button onClick={confirm} disabled={!canConfirm}>
            {saving ? 'Shipping…' : `Confirm & Create ${shipmentGroups.length || ''} Shipment${shipmentGroups.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
