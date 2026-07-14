import React, { useState, useEffect } from 'react';
import { useUser, useLoadAction, useMutateAction } from '@uibakery/data';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Ban, Check, Copy, Crown, ChevronsUpDown, Plus, Search, Trash2 } from 'lucide-react';
import searchCustomers from '@/actions/orders/searchCustomers';
import searchProducts from '@/actions/orders/searchProducts';
import getReceiveWallets from '@/actions/orders/getReceiveWallets';
import getFreeOrderReasons from '@/actions/orders/getFreeOrderReasons';
import listSalesReps from '@/actions/orders/listSalesReps';
import createOrder from '@/actions/orders/createOrder';
import createOrderItem from '@/actions/orders/createOrderItem';
import createOrderPayment from '@/actions/orders/createOrderPayment';
import createCustomer from '@/actions/orders/createCustomer';
import checkDuplicateCustomer from '@/actions/orders/checkDuplicateCustomer';
import insertAuditLog from '@/actions/orders/insertAuditLog';

type Customer = {
  id: number; full_name: string; email: string; phone: string;
  preferred_channel: string; channel_handle: string;
  is_vip: boolean; is_blocked: boolean; blocked_reason: string;
  ship_address_line1: string; ship_address_line2: string;
  ship_city: string; ship_state: string; ship_postal_code: string; ship_country: string;
};
type Product = {
  id: number; sku: string; name: string; list_price: string;
  available_warehouse: boolean; available_china_direct: boolean; available_stock: number;
};
type LineItem = {
  key: string; product: Product | null;
  quantity: number; unit_price: number;
  fulfillment_source: 'warehouse' | 'china_direct';
  price_mode: 'list' | 'tier' | 'manual' | 'free';
};
type Wallet = { id: number; asset: string; network: string; address: string; label: string };
type FreeReason = { id: number; label: string };

const CHANNELS = ['telegram', 'signal', 'discord', 'whatsapp', 'other'];
const ASSETS = ['USDC', 'USDT', 'ETH', 'SOL', 'BTC'];
const NETWORKS: Record<string, string[]> = {
  USDC: ['ETH', 'SOL'], USDT: ['ETH', 'SOL'], ETH: ['ETH'], SOL: ['SOL'], BTC: ['BTC'],
};

function mkLine(): LineItem {
  return { key: Math.random().toString(36).slice(2), product: null, quantity: 1, unit_price: 0, fulfillment_source: 'warehouse', price_mode: 'list' };
}

function CustomerCombo({ onSelect }: { onSelect: (c: Customer) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, , , reload] = useLoadAction(searchCustomers, [], { q }, { enabled: false });
  useEffect(() => { if (q.length >= 2) reload(); }, [q]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal text-muted-foreground">
          Search by name, email, phone… <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No customers found.</CommandEmpty>
            <CommandGroup>
              {(res as Customer[]).map(c => (
                <CommandItem key={c.id} onSelect={() => { onSelect(c); setOpen(false); setQ(''); }}>
                  <div className="flex flex-col">
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-xs text-muted-foreground">{c.email} · {c.phone}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProductCombo({ onAdd, isFree }: { onAdd: (p: Product) => void; isFree: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, , , reload] = useLoadAction(searchProducts, [], { q }, { enabled: false });
  useEffect(() => { reload(); }, [q]);
  useEffect(() => { if (open) reload(); }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start font-normal text-muted-foreground">
          <Search className="h-3 w-3 mr-1" /> Add product by SKU or name…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {(res as Product[]).map(p => (
                <CommandItem key={p.id} onSelect={() => { onAdd(p); setOpen(false); setQ(''); }}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {p.available_warehouse && (
                        <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600 border-blue-200">
                          WH {p.available_stock > 0 ? `(${p.available_stock})` : '(0)'}
                        </Badge>
                      )}
                      {p.available_china_direct && (
                        <Badge variant="outline" className="text-xs px-1 py-0 text-purple-600 border-purple-200">CN</Badge>
                      )}
                      <span className="text-muted-foreground">${Number(p.list_price).toFixed(2)}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function NewCustomerDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (c: Customer) => void;
}) {
  const initForm = { full_name: '', email: '', phone: '', preferred_channel: 'telegram', channel_handle: '', ship_address_line1: '', ship_address_line2: '', ship_city: '', ship_state: '', ship_postal_code: '', ship_country: 'US', is_vip: false, notes: '' };
  const [form, setForm] = useState(initForm);
  const [dupOpen, setDupOpen] = useState(false);
  const [dups, setDups] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [checkDup, checking] = useMutateAction(checkDuplicateCustomer);
  const [doCreate, creating] = useMutateAction(createCustomer);
  const sf = (k: keyof typeof initForm) => (v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (force = false) => {
    if (!form.full_name.trim()) { setError('Name is required'); return; }
    setError('');
    if (!force) {
      const found = await checkDup({ fullName: form.full_name, shipAddressLine1: form.ship_address_line1 }) as Customer[];
      if (found?.length > 0) { setDups(found); setDupOpen(true); return; }
    }
    const res = await doCreate({
      fullName: form.full_name, email: form.email || null, phone: form.phone || null,
      preferredChannel: form.preferred_channel, channelHandle: form.channel_handle || null,
      shipAddressLine1: form.ship_address_line1 || null, shipAddressLine2: form.ship_address_line2 || null,
      shipCity: form.ship_city || null, shipState: form.ship_state || null,
      shipPostalCode: form.ship_postal_code || null, shipCountry: form.ship_country || 'US',
      isVip: form.is_vip, notes: form.notes || null, internalNotes: null,
    }) as { id: number; full_name: string }[];
    if (res?.[0]) { onCreated({ ...form, id: res[0].id } as unknown as Customer); onClose(); setForm(initForm); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => sf('full_name')(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => sf('email')(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => sf('phone')(e.target.value)} /></div>
            <div>
              <Label>Channel</Label>
              <Select value={form.preferred_channel} onValueChange={sf('preferred_channel')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Handle</Label><Input value={form.channel_handle} onChange={e => sf('channel_handle')(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address Line 1</Label><Input value={form.ship_address_line1} onChange={e => sf('ship_address_line1')(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address Line 2</Label><Input value={form.ship_address_line2} onChange={e => sf('ship_address_line2')(e.target.value)} /></div>
            <div><Label>City</Label><Input value={form.ship_city} onChange={e => sf('ship_city')(e.target.value)} /></div>
            <div><Label>State</Label><Input value={form.ship_state} onChange={e => sf('ship_state')(e.target.value)} /></div>
            <div><Label>Postal</Label><Input value={form.ship_postal_code} onChange={e => sf('ship_postal_code')(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={form.ship_country} onChange={e => sf('ship_country')(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => submit(false)} disabled={creating || checking}>Create Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Possible Duplicate Detected</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Found customers with matching name and address:</p>
          <div className="space-y-2 mb-4">
            {dups.map(d => (
              <div key={d.id} className="border rounded p-3 text-sm space-y-1">
                <p className="font-medium">{d.full_name}</p>
                <p className="text-muted-foreground text-xs">{d.email} · {d.ship_address_line1}, {d.ship_city}</p>
                <Button size="sm" variant="outline" className="mt-1" onClick={() => { onCreated(d); setDupOpen(false); onClose(); }}>
                  Use This Customer
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>Cancel</Button>
            <Button onClick={() => { setDupOpen(false); submit(true); }}>Create Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface NewOrderFormProps {
  open: boolean; onClose: () => void; onSaved: () => void; prefillCustomer?: Customer | null;
}

export function NewOrderForm({ open, onClose, onSaved, prefillCustomer }: NewOrderFormProps) {
  const user = useUser();
  const isAdmin = user.roles?.includes('admin') ?? false;
  const [wallets] = useLoadAction(getReceiveWallets, []);
  const [freeReasons] = useLoadAction(getFreeOrderReasons, []);
  const [salesReps] = useLoadAction(listSalesReps, []);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [channel, setChannel] = useState('telegram');
  const [salesRepId, setSalesRepId] = useState<string>('');
  const [isFree, setIsFree] = useState(false);
  const [freeReasonId, setFreeReasonId] = useState('');
  const [freeNote, setFreeNote] = useState('');
  const [partial, setPartial] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([mkLine()]);
  const [discount, setDiscount] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [notes, setNotes] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [ship, setShip] = useState({ name: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US' });
  const [editShip, setEditShip] = useState(false);
  const [payAsset, setPayAsset] = useState('USDC');
  const [payNetwork, setPayNetwork] = useState('ETH');
  const [paySpot, setPaySpot] = useState('');
  const [payTx, setPayTx] = useState('');
  const [addPay, setAddPay] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [doCreate, creating] = useMutateAction(createOrder);
  const [doItem] = useMutateAction(createOrderItem);
  const [doPayment] = useMutateAction(createOrderPayment);
  const [doAudit] = useMutateAction(insertAuditLog);

  useEffect(() => { if (prefillCustomer) pickCustomer(prefillCustomer); }, [prefillCustomer]);

  const pickCustomer = (c: Customer) => {
    setCustomer(c);
    setChannel(c.preferred_channel || 'telegram');
    setShip({ name: c.full_name, line1: c.ship_address_line1 || '', line2: c.ship_address_line2 || '', city: c.ship_city || '', state: c.ship_state || '', postal: c.ship_postal_code || '', country: c.ship_country || 'US' });
  };

  const addLine = (p: Product) => {
    const stock = Number(p.available_stock);
    const src: LineItem['fulfillment_source'] = p.available_warehouse && stock >= 1 ? 'warehouse' : 'china_direct';
    setLines(prev => [...prev.filter(l => l.product !== null), { key: Math.random().toString(36).slice(2), product: p, quantity: 1, unit_price: isFree ? 0 : Number(p.list_price), fulfillment_source: src, price_mode: isFree ? 'free' : 'list' }]);
  };
  const upLine = (key: string, patch: Partial<LineItem>) => setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const rmLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const subtotal = lines.reduce((s, l) => s + (l.product ? l.quantity * l.unit_price : 0), 0);
  const total = Math.max(0, subtotal - Number(discount) + Number(shipping));

  const selectedWallet = (wallets as Wallet[]).find(w => w.asset === payAsset && w.network === payNetwork);
  const amountAsset = paySpot && Number(paySpot) > 0 ? (total / Number(paySpot)).toFixed(6) : '—';

  const copyWallet = () => {
    if (selectedWallet) { navigator.clipboard.writeText(selectedWallet.address); setCopiedWallet(true); setTimeout(() => setCopiedWallet(false), 2000); }
  };

  const validate = (s: 'draft' | 'confirmed'): string[] => {
    const errs: string[] = [];
    if (!customer) errs.push('Select a customer');
    if (lines.filter(l => l.product).length === 0) errs.push('Add at least one line item');
    if (isFree && !freeReasonId) errs.push('Free order reason is required');
    if (isFree && !freeNote.trim()) errs.push('Free order note is required');
    if (s === 'confirmed' && customer?.is_blocked && !overrideNote.trim()) errs.push('Override note required for blocked customer (admin)');
    if (s === 'confirmed') {
      const wLines = lines.filter(l => l.product && l.fulfillment_source === 'warehouse');
      const ctry = ship.country.trim().toUpperCase();
      if (wLines.length > 0 && !['US', 'USA', 'UNITED STATES'].includes(ctry)) {
        errs.push(`Warehouse ships US-only. Switch to China-Direct or update address: ${wLines.map(l => l.product?.name).join(', ')}`);
      }
    }
    return errs;
  };

  const save = async (s: 'draft' | 'confirmed') => {
    const errs = validate(s);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    const res = await doCreate({
      customerId: customer!.id, shipToName: ship.name || customer!.full_name,
      shipAddressLine1: ship.line1, shipAddressLine2: ship.line2 || null,
      shipCity: ship.city, shipState: ship.state, shipPostalCode: ship.postal, shipCountry: ship.country,
      orderChannel: channel, isFreeOrder: isFree,
      freeOrderReasonId: isFree && freeReasonId ? Number(freeReasonId) : null,
      freeOrderNote: isFree ? freeNote : null,
      partialFulfillmentAllowed: partial, status: s,
      subtotalUsd: subtotal, customerShippingChargeUsd: Number(shipping), discountUsd: Number(discount), totalUsd: total,
      notes: notes || null, createdByUserId: user.email,
      salesRepUserProfileId: salesRepId ? Number(salesRepId) : null,
    }) as { id: number; order_number: string }[];
    if (!res?.[0]) return;
    const orderId = res[0].id;
    for (const l of lines.filter(x => x.product)) {
      await doItem({ orderId, productId: l.product!.id, quantity: l.quantity, unitPriceUsd: l.unit_price, lineTotalUsd: l.quantity * l.unit_price, fulfillmentSource: l.fulfillment_source });
    }
    if (addPay && total > 0 && paySpot && selectedWallet) {
      await doPayment({ orderId, asset: payAsset, network: payNetwork, walletId: selectedWallet.id, spotRateUsd: Number(paySpot), amountAsset: Number(amountAsset), amountUsd: total, txHash: payTx || null });
    }
    if (s === 'confirmed' && customer?.is_blocked && overrideNote.trim()) {
      await doAudit({ orderId, userId: user.email, changeType: 'blocked_override', fieldName: 'status', oldValue: null, newValue: 'confirmed', note: overrideNote });
    }
    onSaved(); onClose(); reset();
  };

  const reset = () => {
    setCustomer(null); setChannel('telegram'); setIsFree(false); setFreeReasonId(''); setFreeNote('');
    setPartial(false); setLines([mkLine()]); setDiscount('0'); setShipping('0'); setNotes('');
    setOverrideNote(''); setShip({ name: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US' });
    setEditShip(false); setPayAsset('USDC'); setPayNetwork('ETH'); setPaySpot(''); setPayTx('');
    setAddPay(false); setErrors([]); setSalesRepId('');
  };

  const isBlocked = !!customer?.is_blocked;
  const canConfirm = !isBlocked || isAdmin;

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6" side="right">
          <SheetHeader className="mb-4">
            <SheetTitle>New Order</SheetTitle>
            <p className="text-sm text-muted-foreground">Order #: auto-generated · By: <span className="font-medium">{user.name || user.email}</span></p>
          </SheetHeader>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 space-y-1">
              {errors.map((e, i) => <p key={i} className="text-sm text-red-700">{e}</p>)}
            </div>
          )}

          {/* Customer */}
          <section className="mb-4 space-y-2">
            <Label className="font-semibold">Customer</Label>
            {customer ? (
              <div className="border rounded p-3 space-y-1">
                {isBlocked && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 flex gap-2 mb-2">
                    <Ban className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Customer Blocked</p>
                      {customer.blocked_reason && <p className="text-xs text-red-600">{customer.blocked_reason}</p>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">{customer.full_name}</span>
                  {customer.is_vip && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs px-1 py-0"><Crown className="h-3 w-3 inline mr-0.5" />VIP</Badge>}
                  {isBlocked && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-1 py-0">Blocked</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{customer.email} · {customer.phone}</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setCustomer(null)}>Change</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <CustomerCombo onSelect={pickCustomer} />
                <Button variant="outline" size="sm" className="w-full" onClick={() => setNewCustOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Create New Customer
                </Button>
              </div>
            )}
          </section>

          {/* Admin override for blocked customer */}
          {isBlocked && isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
              <p className="text-sm font-medium text-amber-800 mb-1">Admin Override — Add Note</p>
              <Input placeholder="Note explaining override…" value={overrideNote} onChange={e => setOverrideNote(e.target.value)} />
            </div>
          )}

          {/* Channel + Partial */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <Label>Order Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sales Rep</Label>
              <Select value={salesRepId} onValueChange={setSalesRepId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {((salesReps as { id: number; display_name: string }[]) || []).map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Partial Fulfillment</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={partial} onCheckedChange={setPartial} />
                <span className="text-xs text-muted-foreground">{partial ? 'Ship available now' : 'Hold until all in stock'}</span>
              </div>
            </div>
          </div>

          {/* Free Order */}
          <div className="border rounded p-3 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={isFree} onCheckedChange={v => { setIsFree(v); if (v) setLines(prev => prev.map(l => ({ ...l, unit_price: 0, price_mode: 'free' as const }))); }} />
              <Label>Free Order</Label>
            </div>
            {isFree && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Reason *</Label>
                  <Select value={freeReasonId} onValueChange={setFreeReasonId}>
                    <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                    <SelectContent>{(freeReasons as FreeReason[]).map(r => <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Note *</Label>
                  <Input placeholder="e.g. marketing sample for @influencer_x" value={freeNote} onChange={e => setFreeNote(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Ship To */}
          <div className="border rounded p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-semibold">Ship To</Label>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setEditShip(v => !v)}>
                {editShip ? 'Collapse' : 'Edit shipping address'}
              </Button>
            </div>
            {!editShip ? (
              <p className="text-sm text-muted-foreground">{ship.name || customer?.full_name || '—'}, {ship.line1}, {ship.city} {ship.state} {ship.postal}, {ship.country}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={ship.name} onChange={e => setShip(s => ({ ...s, name: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Address Line 1</Label><Input value={ship.line1} onChange={e => setShip(s => ({ ...s, line1: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Address Line 2</Label><Input value={ship.line2} onChange={e => setShip(s => ({ ...s, line2: e.target.value }))} /></div>
                <div><Label className="text-xs">City</Label><Input value={ship.city} onChange={e => setShip(s => ({ ...s, city: e.target.value }))} /></div>
                <div><Label className="text-xs">State</Label><Input value={ship.state} onChange={e => setShip(s => ({ ...s, state: e.target.value }))} /></div>
                <div><Label className="text-xs">Postal</Label><Input value={ship.postal} onChange={e => setShip(s => ({ ...s, postal: e.target.value }))} /></div>
                <div><Label className="text-xs">Country</Label><Input value={ship.country} onChange={e => setShip(s => ({ ...s, country: e.target.value }))} /></div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="mb-4">
            <Label className="font-semibold mb-2 block">Line Items</Label>
            <div className="space-y-2 mb-2">
              {lines.filter(l => l.product).map(line => (
                <div key={line.key} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{line.product!.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{line.product!.sku}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => rmLine(line.key)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Qty (kits)</Label>
                      <Input type="number" min={1} value={line.quantity} onChange={e => upLine(line.key, { quantity: Number(e.target.value) })} className="h-8" /></div>
                    <div><Label className="text-xs">Unit Price</Label>
                      <Input type="number" min={0} step={0.01} value={line.unit_price} onChange={e => upLine(line.key, { unit_price: Number(e.target.value), price_mode: 'manual' })} className="h-8" /></div>
                    <div><Label className="text-xs">Source</Label>
                      <Select value={line.fulfillment_source} onValueChange={v => upLine(line.key, { fulfillment_source: v as LineItem['fulfillment_source'] })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {line.product!.available_warehouse && <SelectItem value="warehouse">Warehouse</SelectItem>}
                          {line.product!.available_china_direct && <SelectItem value="china_direct">China Direct</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex gap-1">
                      {line.fulfillment_source === 'warehouse' && (
                        <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600 border-blue-200">
                          {Number(line.product!.available_stock) > 0 ? `${line.product!.available_stock} in stock` : 'Out of stock'}
                        </Badge>
                      )}
                      {line.price_mode === 'tier' && <Badge variant="outline" className="text-xs px-1 py-0 text-green-600 border-green-200">Tier applied</Badge>}
                      {line.price_mode === 'manual' && <Badge variant="outline" className="text-xs px-1 py-0 text-orange-600 border-orange-200">Manual override</Badge>}
                    </div>
                    <span className="font-medium">${(line.quantity * line.unit_price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <ProductCombo onAdd={addLine} isFree={isFree} />
          </div>

          {/* Totals */}
          <div className="border rounded p-3 mb-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Discount ($)</span>
              <Input type="number" min={0} step={0.01} value={discount} onChange={e => setDiscount(e.target.value)} className="h-7 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Shipping ($)</span>
              <Input type="number" min={0} step={0.01} value={shipping} onChange={e => setShipping(e.target.value)} className="h-7 w-28" />
            </div>
            <Separator />
            <div className="flex justify-between font-semibold"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>

          {/* Payment */}
          <div className="border rounded p-3 mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={addPay} onCheckedChange={setAddPay} disabled={total === 0} />
              <Label>Add Crypto Payment {total === 0 && <span className="text-xs text-muted-foreground">(not required — $0 total)</span>}</Label>
            </div>
            {addPay && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Asset</Label>
                    <Select value={payAsset} onValueChange={v => { setPayAsset(v); setPayNetwork(NETWORKS[v]?.[0] || ''); }}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Network</Label>
                    <Select value={payNetwork} onValueChange={setPayNetwork}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{(NETWORKS[payAsset] || []).map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Spot Rate (USD per {payAsset})</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} step={0.01} value={paySpot} onChange={e => setPaySpot(e.target.value)} className="h-8" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">= {amountAsset} {payAsset}</span>
                  </div>
                </div>
                {selectedWallet && (
                  <div className="bg-muted/40 rounded p-2">
                    <Label className="text-xs mb-1 block">Receive Address ({selectedWallet.label})</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs flex-1 break-all">{selectedWallet.address}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyWallet}>
                        {copiedWallet ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
                <div><Label className="text-xs">TX Hash (optional)</Label>
                  <Input placeholder="0x…" value={payTx} onChange={e => setPayTx(e.target.value)} className="h-8" /></div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6 space-y-1">
            <Label>Internal Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes…" />
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" onClick={() => save('draft')} disabled={creating}>Save Draft</Button>
            {canConfirm ? (
              <Button onClick={() => save('confirmed')} disabled={creating}>Confirm Order</Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}><Button disabled>Confirm Order</Button></span>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">Customer is blocked. Admins can confirm with an override note.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NewCustomerDialog open={newCustOpen} onClose={() => setNewCustOpen(false)} onCreated={c => { pickCustomer(c); setNewCustOpen(false); }} />
    </>
  );
}
