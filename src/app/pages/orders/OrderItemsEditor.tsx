import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeftRight, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import updateOrderItemQtyPrice from '@/actions/orders/updateOrderItemQtyPrice';
import deleteOrderItem from '@/actions/orders/deleteOrderItem';
import switchItemSource from '@/actions/orders/switchItemSource';
import createOrderItem from '@/actions/orders/createOrderItem';
import recalcOrderTotals from '@/actions/orders/recalcOrderTotals';
import updateOrderShipTo from '@/actions/orders/updateOrderShipTo';
import insertAuditLog from '@/actions/orders/insertAuditLog';
import searchProducts from '@/actions/orders/searchProducts';
import reserveProductStockFifo from '@/actions/warehouse/reserveProductStockFifo';
import reserveBatchStock from '@/actions/warehouse/reserveBatchStock';
import listWarehouseAvailability from '@/actions/orders/listWarehouseAvailability';
import releaseProductReservation from '@/actions/warehouse/releaseProductReservation';

export type OrderItemRow = {
  id: number; sales_order_id: number; product_id: number; quantity: number;
  unit_price_usd: string; line_total_usd: string; fulfillment_source: string;
  product_name: string; product_sku: string;
  available_warehouse: boolean; available_china_direct: boolean;
  is_shipped: boolean;
  preferred_batch_id: number | null; preferred_batch_number: string | null;
  preferred_warehouse_id: number | null; preferred_warehouse_name: string | null;
};
export type AllocationRow = {
  id: number; sales_order_item_id: number; quantity: number;
  batch_number: string; warehouse_name: string; quantity_shipped: number;
};
type OrderLike = Record<string, string | number | boolean | null>;
type ProductOption = { id: number; sku: string; name: string; list_price: string; available_warehouse: boolean; available_china_direct: boolean; available_stock: number };

/**
 * Edit-after-confirm items panel (prompt rules): unshipped/unallocated lines
 * stay editable (qty, price, source, remove) with every change audited;
 * allocated/shipped lines are locked. Reservations follow edits on
 * warehouse-sourced lines via the reservation ledger.
 */
export function OrderItemsEditor({ orderId, order, items, allocations, isReadOnly, onChanged }: {
  orderId: number;
  order: OrderLike;
  items: OrderItemRow[];
  allocations: AllocationRow[];
  isReadOnly: boolean;
  onChanged: () => void;
}) {
  const { profileId } = useAppUser();
  const [doUpdateItem] = useMutateAction(updateOrderItemQtyPrice);
  const [doDeleteItem] = useMutateAction(deleteOrderItem);
  const [doSwitchSource] = useMutateAction(switchItemSource);
  const [doCreateItem] = useMutateAction(createOrderItem);
  const [doRecalc] = useMutateAction(recalcOrderTotals);
  const [doShipTo] = useMutateAction(updateOrderShipTo);
  const [doAudit] = useMutateAction(insertAuditLog);
  const [doReserve] = useMutateAction(reserveProductStockFifo);
  const [doReserveBatch] = useMutateAction(reserveBatchStock);
  const [doRelease] = useMutateAction(releaseProductReservation);

  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [products] = useLoadAction(searchProducts, [addOpen], { q: '' }, { enabled: addOpen });
  const productOptions = asRows<ProductOption>(products);
  const [whAvailRaw] = useLoadAction(listWarehouseAvailability, [addOpen], {}, { enabled: addOpen });
  const whAvailability = asRows<{ product_id: number; warehouse_id: number; warehouse_name: string; available: number }>(whAvailRaw);

  const [shipToOpen, setShipToOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ name: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US' });

  const [editTotals, setEditTotals] = useState(false);
  const [discount, setDiscount] = useState('');
  const [shipping, setShipping] = useState('');

  const orderStatusConfirmedPlus = ['confirmed', 'partially_shipped'].includes(String(order.status));
  // Reservations target each line's fulfillment warehouse (split shipments)
  // or the order-level one when the line has none.
  const orderWh = order.preferred_warehouse_id ? Number(order.preferred_warehouse_id) : null;
  const preferredWh = orderWh != null ? String(orderWh) : '';
  const itemWh = (i: OrderItemRow): number | null => i.preferred_warehouse_id ?? orderWh;

  // Reservations are ledgered per (order, product) — a release wipes EVERY
  // line's reservation for that product. So any resync must re-reserve ALL
  // still-open warehouse lines of the product, honoring each line's batch
  // pin: pinned quantities reserve from their batch first, everything left
  // (unpinned lines + pinned shortfalls) tops up via one FIFO reserve.
  type LineSpec = { qty: number; batchId: number | null; whId: number | null };

  const siblingWarehouseLines = (productId: number, excludeItemId: number): LineSpec[] =>
    items
      .filter(i => i.product_id === productId && i.id !== excludeItemId
        && i.fulfillment_source === 'warehouse' && !i.is_shipped
        && !allocations.some(a => a.sales_order_item_id === i.id))
      .map(i => ({ qty: Number(i.quantity), batchId: i.preferred_batch_id, whId: itemWh(i) }));

  const resyncProductReservation = async (productId: number, lineSpecs: LineSpec[]) => {
    await doRelease({ order_id: orderId, product_id: productId });
    // Pinned lines reserve their batch at their warehouse; the rest is
    // FIFO-topped-up per warehouse ('' = any) so split lines stay split.
    const fifoByWh = new Map<string, number>();
    for (const l of lineSpecs) {
      if (l.qty <= 0) continue;
      const whParam = l.whId != null ? String(l.whId) : '';
      if (l.batchId != null) {
        const got = await doReserveBatch({ order_id: orderId, product_id: productId, batch_id: l.batchId, quantity: l.qty, warehouse_id: whParam }) as { reserved_qty: number }[];
        const short = Math.max(0, l.qty - (got || []).reduce((s, r) => s + Number(r?.reserved_qty || 0), 0));
        if (short > 0) fifoByWh.set(whParam, (fifoByWh.get(whParam) || 0) + short);
      } else {
        fifoByWh.set(whParam, (fifoByWh.get(whParam) || 0) + l.qty);
      }
    }
    for (const [whParam, qty] of fifoByWh) {
      await doReserve({ order_id: orderId, product_id: productId, quantity: qty, warehouse_id: whParam });
    }
  };

  const recalc = async (discountUsd?: number, shippingUsd?: number) => {
    await doRecalc({
      orderId,
      discountUsd: discountUsd ?? (Number(order.discount_usd) || 0),
      shippingUsd: shippingUsd ?? (Number(order.customer_shipping_charge_usd) || 0),
    });
  };

  const startEdit = (it: OrderItemRow) => {
    setEditId(it.id); setEditQty(String(it.quantity)); setEditPrice(String(Number(it.unit_price_usd)));
  };

  const saveEdit = async (it: OrderItemRow) => {
    const qty = Math.max(1, parseInt(editQty) || 0);
    const price = Math.max(0, parseFloat(editPrice) || 0);
    setBusy(true); setError('');
    const res = await doUpdateItem({ itemId: it.id, quantity: qty, unitPriceUsd: price }) as unknown[];
    if (!res || res.length === 0) {
      setError(`${it.product_name}: line is locked (already allocated/shipped).`);
      setBusy(false); setEditId(null); onChanged();
      return;
    }
    // Re-sync reservations at the new quantity plus any sibling lines'.
    if (it.fulfillment_source === 'warehouse' && orderStatusConfirmedPlus) {
      await resyncProductReservation(it.product_id, [{ qty, batchId: it.preferred_batch_id, whId: itemWh(it) }, ...siblingWarehouseLines(it.product_id, it.id)]);
    }
    if (qty !== Number(it.quantity)) {
      await doAudit({ orderId, userId: profileId, changeType: 'line_item_qty', fieldName: `line.${it.product_sku}.quantity`, oldValue: String(it.quantity), newValue: String(qty), note: null });
    }
    if (price !== Number(it.unit_price_usd)) {
      await doAudit({ orderId, userId: profileId, changeType: 'line_item_price', fieldName: `line.${it.product_sku}.unit_price`, oldValue: String(Number(it.unit_price_usd)), newValue: String(price), note: null });
    }
    await recalc();
    setBusy(false); setEditId(null);
    onChanged();
  };

  const removeItem = async (it: OrderItemRow) => {
    setBusy(true); setError('');
    const res = await doDeleteItem({ itemId: it.id }) as unknown[];
    if (!res || res.length === 0) {
      setError(`${it.product_name}: line is locked (already allocated/shipped).`);
      setBusy(false); onChanged();
      return;
    }
    if (it.fulfillment_source === 'warehouse' && orderStatusConfirmedPlus) {
      await resyncProductReservation(it.product_id, siblingWarehouseLines(it.product_id, it.id));
    }
    await doAudit({ orderId, userId: profileId, changeType: 'line_item_removed', fieldName: `line.${it.product_sku}`, oldValue: `${it.quantity} @ $${Number(it.unit_price_usd).toFixed(2)}`, newValue: null, note: null });
    await recalc();
    setBusy(false);
    onChanged();
  };

  const switchSource = async (it: OrderItemRow) => {
    const target = it.fulfillment_source === 'warehouse' ? 'china_direct' : 'warehouse';
    setBusy(true); setError('');
    if (target === 'warehouse') {
      if (!it.available_warehouse) { setError(`${it.product_name} is not sellable through the warehouse channel.`); setBusy(false); return; }
      // Reserve first; block the switch when no stock at all (prompt rule).
      const reserved = orderStatusConfirmedPlus
        ? await doReserve({ order_id: orderId, product_id: it.product_id, quantity: Number(it.quantity), warehouse_id: preferredWh }) as { reserved_qty: number }[]
        : [];
      if (orderStatusConfirmedPlus && (!reserved || reserved.length === 0)) {
        setError(`${it.product_name}: no warehouse stock available to reserve — line stays China-Direct.`);
        setBusy(false);
        return;
      }
    }
    const res = await doSwitchSource({ itemId: it.id, source: target }) as unknown[];
    if (!res || res.length === 0) {
      // Locked line — undo the reservation we just added by resyncing back to
      // the sibling lines' total (line itself stays on its original source).
      if (target === 'warehouse' && orderStatusConfirmedPlus) {
        await resyncProductReservation(it.product_id, siblingWarehouseLines(it.product_id, it.id));
      }
      setError(`${it.product_name}: line is locked (already allocated/shipped).`);
      setBusy(false); onChanged();
      return;
    }
    if (target === 'china_direct' && orderStatusConfirmedPlus) {
      // Switching away from warehouse: keep only the sibling lines reserved.
      await resyncProductReservation(it.product_id, siblingWarehouseLines(it.product_id, it.id));
    }
    await doAudit({ orderId, userId: profileId, changeType: 'other', fieldName: `line.${it.product_sku}.fulfillment_source`, oldValue: it.fulfillment_source, newValue: target, note: null });
    setBusy(false);
    onChanged();
  };

  const addItem = async () => {
    const p = productOptions.find(x => String(x.id) === addProductId);
    if (!p) return;
    const qty = Math.max(1, parseInt(addQty) || 1);
    const price = addPrice !== '' ? Math.max(0, parseFloat(addPrice) || 0) : Number(p.list_price);
    const source = p.available_warehouse && Number(p.available_stock) >= qty ? 'warehouse' : 'china_direct';
    setBusy(true); setError('');
    // On a split order (no order-level warehouse, lines carry their own),
    // a new line must stay in the split model: assign it the warehouse
    // that best covers it (covers qty, else most stock) instead of
    // letting it reserve auto-FIFO across warehouses.
    const orderIsSplit = orderWh == null && items.some(i => i.preferred_warehouse_id != null);
    let lineWhId: number | null = null;
    if (source === 'warehouse' && orderIsSplit) {
      const best = whAvailability
        .filter(a => a.product_id === p.id)
        .sort((a, b) => Number(b.available >= qty) - Number(a.available >= qty) || b.available - a.available)[0];
      lineWhId = best ? best.warehouse_id : null;
    }
    await doCreateItem({ orderId, productId: p.id, quantity: qty, unitPriceUsd: price, lineTotalUsd: qty * price, fulfillmentSource: source, preferredBatchId: null, preferredWarehouseId: lineWhId });
    if (source === 'warehouse' && orderStatusConfirmedPlus) {
      await doReserve({ order_id: orderId, product_id: p.id, quantity: qty, warehouse_id: lineWhId != null ? String(lineWhId) : preferredWh });
    }
    await doAudit({ orderId, userId: profileId, changeType: 'line_item_added', fieldName: `line.${p.sku}`, oldValue: null, newValue: `${qty} @ $${price.toFixed(2)} (${source})`, note: null });
    await recalc();
    setBusy(false);
    setAddOpen(false); setAddProductId(''); setAddQty('1'); setAddPrice('');
    onChanged();
  };

  const openShipTo = () => {
    setShipForm({
      name: String(order.ship_to_name || ''), line1: String(order.ship_address_line1 || ''),
      line2: String(order.ship_address_line2 || ''), city: String(order.ship_city || ''),
      state: String(order.ship_state || ''), postal: String(order.ship_postal_code || ''),
      country: String(order.ship_country || 'US'),
    });
    setShipToOpen(true);
  };

  const saveShipTo = async () => {
    setBusy(true);
    const before = `${order.ship_to_name}, ${order.ship_address_line1}, ${order.ship_city} ${order.ship_state} ${order.ship_postal_code}, ${order.ship_country}`;
    const after = `${shipForm.name}, ${shipForm.line1}, ${shipForm.city} ${shipForm.state} ${shipForm.postal}, ${shipForm.country}`;
    await doShipTo({ orderId, shipToName: shipForm.name, line1: shipForm.line1, line2: shipForm.line2 || null, city: shipForm.city, state: shipForm.state, postal: shipForm.postal, country: shipForm.country });
    await doAudit({ orderId, userId: profileId, changeType: 'ship_to', fieldName: 'ship_to', oldValue: before, newValue: after, note: null });
    setBusy(false); setShipToOpen(false);
    onChanged();
  };

  const saveTotals = async () => {
    const d = Math.max(0, parseFloat(discount) || 0);
    const s = Math.max(0, parseFloat(shipping) || 0);
    setBusy(true);
    if (d !== Number(order.discount_usd)) {
      await doAudit({ orderId, userId: profileId, changeType: 'discount', fieldName: 'discount_usd', oldValue: String(Number(order.discount_usd)), newValue: String(d), note: null });
    }
    if (s !== Number(order.customer_shipping_charge_usd)) {
      await doAudit({ orderId, userId: profileId, changeType: 'shipping_cost', fieldName: 'customer_shipping_charge_usd', oldValue: String(Number(order.customer_shipping_charge_usd)), newValue: String(s), note: null });
    }
    await recalc(d, s);
    setBusy(false); setEditTotals(false);
    onChanged();
  };

  return (
    <div className="space-y-2">
      {items.map(item => {
        const itemAllocs = allocations.filter(a => a.sales_order_item_id === item.id);
        const locked = isReadOnly || item.is_shipped || itemAllocs.length > 0;
        return (
          <div key={item.id} className="border rounded-md p-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{item.product_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{item.product_sku}</span>
              </div>
              <div className="flex items-center gap-1">
                {item.is_shipped && <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200">Shipped</Badge>}
                {!locked && (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Edit line" onClick={() => startEdit(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title={`Switch to ${item.fulfillment_source === 'warehouse' ? 'China-Direct' : 'Warehouse'}`} onClick={() => switchSource(item)} disabled={busy}><ArrowLeftRight className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" title="Remove line" onClick={() => removeItem(item)} disabled={busy}><Trash2 className="h-3 w-3" /></Button>
                  </>
                )}
              </div>
            </div>
            {editId === item.id ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min={1} className="h-7 w-20 text-xs" value={editQty} onChange={e => setEditQty(e.target.value)} />
                <Label className="text-xs">Unit $</Label>
                <Input type="number" min={0} step="0.01" className="h-7 w-24 text-xs" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => saveEdit(item)} disabled={busy}><Save className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Qty: {Number(item.quantity)} · @${Number(item.unit_price_usd).toFixed(2)}</span>
                <span className="font-medium text-foreground">${Number(item.line_total_usd).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs px-1 py-0 ${item.fulfillment_source === 'warehouse' ? 'text-blue-600 border-blue-200' : 'text-purple-600 border-purple-200'}`}>
                {item.fulfillment_source === 'warehouse' ? 'Warehouse' : 'China Direct'}
              </Badge>
              {item.fulfillment_source === 'warehouse' && item.preferred_batch_number && (
                <Badge variant="outline" className="text-xs px-1 py-0 text-teal-600 border-teal-200">
                  Batch {item.preferred_batch_number}
                </Badge>
              )}
              {item.fulfillment_source === 'warehouse' && item.preferred_warehouse_name && (
                <Badge variant="outline" className="text-xs px-1 py-0 text-indigo-600 border-indigo-200">
                  From {item.preferred_warehouse_name}
                </Badge>
              )}
              {itemAllocs.map(a => (
                <span key={a.id} className="text-xs text-muted-foreground bg-slate-50 rounded px-1.5 py-0.5">
                  {a.quantity}× {a.batch_number} @ {a.warehouse_name}{Number(a.quantity_shipped) > 0 ? ` (${a.quantity_shipped} shipped)` : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {!isReadOnly && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Item
        </Button>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}

      <Separator />

      {/* Totals */}
      <div className="text-sm space-y-1">
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${Number(order.subtotal_usd).toFixed(2)}</span></div>
        {editTotals ? (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Discount $</Label>
            <Input type="number" min={0} step="0.01" className="h-7 w-24 text-xs" value={discount} onChange={e => setDiscount(e.target.value)} />
            <Label className="text-xs">Shipping $</Label>
            <Input type="number" min={0} step="0.01" className="h-7 w-24 text-xs" value={shipping} onChange={e => setShipping(e.target.value)} />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={saveTotals} disabled={busy}><Save className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTotals(false)}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>−${Number(order.discount_usd).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Customer Shipping</span>
              <span>${Number(order.customer_shipping_charge_usd).toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>${Number(order.total_usd).toFixed(2)}</span>
        </div>
        {!isReadOnly && !editTotals && (
          <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 px-0" onClick={() => { setDiscount(String(Number(order.discount_usd))); setShipping(String(Number(order.customer_shipping_charge_usd))); setEditTotals(true); }}>
            Edit discount / shipping
          </Button>
        )}
      </div>

      <Separator />

      {/* Ship-to */}
      <div className="text-sm space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Ship To</span>
          {!isReadOnly && <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" onClick={openShipTo}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
        </div>
        <p>{String(order.ship_to_name || '')} · {String(order.ship_address_line1 || '')}, {String(order.ship_city || '')} {String(order.ship_state || '')} {String(order.ship_postal_code || '')}, {String(order.ship_country || '')}</p>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Line Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Product</Label>
              <Select value={addProductId} onValueChange={v => { setAddProductId(v); const p = productOptions.find(x => String(x.id) === v); if (p) setAddPrice(String(Number(p.list_price))); }}>
                <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                <SelectContent>
                  {productOptions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} · ${Number(p.list_price).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" min={1} value={addQty} onChange={e => setAddQty(e.target.value)} /></div>
              <div><Label>Unit Price</Label><Input type="number" min={0} step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addItem} disabled={busy || !addProductId}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship-to Dialog */}
      <Dialog open={shipToOpen} onOpenChange={v => !v && setShipToOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Ship-To (this order only)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Name</Label><Input value={shipForm.name} onChange={e => setShipForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Address Line 1</Label><Input value={shipForm.line1} onChange={e => setShipForm(f => ({ ...f, line1: e.target.value }))} /></div>
            <div><Label>Address Line 2</Label><Input value={shipForm.line2} onChange={e => setShipForm(f => ({ ...f, line2: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>City</Label><Input value={shipForm.city} onChange={e => setShipForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={shipForm.state} onChange={e => setShipForm(f => ({ ...f, state: e.target.value }))} /></div>
              <div><Label>Postal</Label><Input value={shipForm.postal} onChange={e => setShipForm(f => ({ ...f, postal: e.target.value }))} /></div>
            </div>
            <div><Label>Country</Label><Input value={shipForm.country} onChange={e => setShipForm(f => ({ ...f, country: e.target.value }))} /></div>
            {items.some(i => i.fulfillment_source === 'warehouse' && !i.is_shipped) && !['US', 'USA', 'UNITED STATES'].includes(shipForm.country.trim().toUpperCase()) && (
              <p className="text-xs text-red-600">Warehouse lines ship to US addresses only — switch those lines to China-Direct or keep a US address.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipToOpen(false)}>Cancel</Button>
            <Button onClick={saveShipTo} disabled={busy || (items.some(i => i.fulfillment_source === 'warehouse' && !i.is_shipped) && !['US', 'USA', 'UNITED STATES'].includes(shipForm.country.trim().toUpperCase()))}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
