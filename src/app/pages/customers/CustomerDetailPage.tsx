import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useParams, useNavigate } from 'react-router-dom';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { StatusBadge, PaymentBadge, ChannelBadge } from '@/app/pages/orders/OrderBadges';
import { OrderDetailDrawer } from '@/app/pages/orders/OrderDetailDrawer';
import { Crown, Ban, ArrowLeft, Plus, Pencil, Trash2, ShoppingCart, Save, X } from 'lucide-react';
import getCustomerDetail from '@/actions/customers/getCustomerDetail';
import getCustomerOrders from '@/actions/customers/getCustomerOrders';
import getCustomerNotes from '@/actions/customers/getCustomerNotes';
import createCustomerNote from '@/actions/customers/createCustomerNote';
import updateCustomerNote from '@/actions/customers/updateCustomerNote';
import deleteCustomerNote from '@/actions/customers/deleteCustomerNote';
import updateCustomer from '@/actions/customers/updateCustomer';
import blockCustomer from '@/actions/customers/blockCustomer';
import unblockCustomer from '@/actions/customers/unblockCustomer';

type CustomerDetail = Record<string, string | number | boolean | null>;
type Order = Record<string, string | number | boolean | null>;
type Note = { id: number; customer_id: number; note_text: string; created_at: string; author_user_id: string; author_name: string };

const CHANNELS = ['telegram', 'signal', 'discord', 'whatsapp', 'root', 'other'];

function NotesPanel({ customerId, readOnly }: { customerId: number; readOnly?: boolean }) {
  const { profileId } = useAppUser();
  const [notes, loading, , reload] = useLoadAction(getCustomerNotes, [customerId], { customerId });
  const [newText, setNewText] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [doCreate, creating] = useMutateAction(createCustomerNote);
  const [doUpdate, updating] = useMutateAction(updateCustomerNote);
  const [doDelete] = useMutateAction(deleteCustomerNote);

  const addNote = async () => {
    if (!newText.trim()) return;
    await doCreate({ customerId, userId: profileId, noteText: newText });
    setNewText(''); reload();
  };

  const saveEdit = async (note: Note) => {
    await doUpdate({ noteId: note.id, userId: profileId, noteText: editText, oldText: note.note_text });
    setEditId(null); reload();
  };

  const deleteNote = async (note: Note) => {
    await doDelete({ noteId: note.id, userId: profileId });
    reload();
  };

  return (
    <div className="space-y-4">
      {/* Add new note */}
      {!readOnly && (
        <>
          <div className="space-y-2">
            <Label className="font-medium">Add Note</Label>
            <Textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Write an interaction note…" rows={3} />
            <Button size="sm" onClick={addNote} disabled={creating || !newText.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Add Note
            </Button>
          </div>
          <Separator />
        </>
      )}
      {/* Notes list */}
      {loading ? <Skeleton className="h-20 w-full" /> : (
        <div className="space-y-3">
          {(notes as Note[]).length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {asRows<Note>(notes).map(note => (
            <div key={note.id} className="border rounded p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{note.author_name || note.author_user_id}</span>
                  <span>·</span>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditId(note.id); setEditText(note.note_text); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => deleteNote(note)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {editId === note.id ? (
                <div className="space-y-2">
                  <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(note)} disabled={updating}><Save className="h-3 w-3 mr-1" /> Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{note.note_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockDialog({ customer, open, onClose, onDone }: {
  customer: CustomerDetail; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { profileId } = useAppUser();
  const [reason, setReason] = useState('');
  const [doBlock, blocking] = useMutateAction(blockCustomer);
  const submit = async () => {
    await doBlock({ customerId: customer.id, reason: reason || null, userId: profileId });
    onDone(); onClose(); setReason('');
  };
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Block Customer</DialogTitle></DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-sm text-muted-foreground">Provide a reason for blocking <strong>{customer.full_name as string}</strong>:</p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)…" rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={blocking || !reason.trim()}>Block Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSalesRep, isLogistics } = useAppUser();
  const canSeeInternalNotes = isAdmin || isSalesRep || isLogistics;
  const customerId = Number(id);

  const [detail, detailLoading, , reloadDetail] = useLoadAction(getCustomerDetail, [customerId], { customerId });
  const [orders, ordersLoading, , reloadOrders] = useLoadAction(getCustomerOrders, [customerId], { customerId });

  // Order drawer opened in place — same full-detail modal as the Sales
  // Orders page, instead of bouncing to /orders.
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

  const customer = (detail as CustomerDetail[])[0];

  // Edit form state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [doUpdate, saving] = useMutateAction(updateCustomer);
  const [doUnblock, unblocking] = useMutateAction(unblockCustomer);
  const [blockOpen, setBlockOpen] = useState(false);

  const startEdit = () => {
    if (!customer) return;
    setForm({
      full_name: String(customer.full_name || ''),
      email: String(customer.email || ''),
      phone: String(customer.phone || ''),
      preferred_channel: String(customer.preferred_channel || 'telegram'),
      channel_handle: String(customer.channel_handle || ''),
      is_vip: !!customer.is_vip,
      ship_address_line1: String(customer.ship_address_line1 || ''),
      ship_address_line2: String(customer.ship_address_line2 || ''),
      ship_city: String(customer.ship_city || ''),
      ship_state: String(customer.ship_state || ''),
      ship_postal_code: dbText(customer.ship_postal_code),
      ship_country: String(customer.ship_country || 'US'),
      notes: String(customer.notes || ''),
      internal_notes: String(customer.internal_notes || ''),
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); };

  const saveEdit = async () => {
    await doUpdate({
      customerId,
      fullName: form.full_name, email: form.email || null, phone: form.phone || null,
      preferredChannel: form.preferred_channel, channelHandle: form.channel_handle || null,
      isVip: form.is_vip,
      shipAddressLine1: form.ship_address_line1 || null, shipAddressLine2: form.ship_address_line2 || null,
      shipCity: form.ship_city || null, shipState: form.ship_state || null,
      shipPostalCode: form.ship_postal_code || null, shipCountry: form.ship_country || 'US',
      notes: form.notes || null, internalNotes: form.internal_notes || null,
    });
    setEditing(false); reloadDetail();
  };

  const handleUnblock = async () => {
    await doUnblock({ customerId });
    reloadDetail();
  };

  const sf = (k: string) => (v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  if (detailLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-6 text-muted-foreground">Customer not found.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{String(customer.full_name)}</h1>
            {customer.is_vip && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-1.5"><Crown className="h-3 w-3 mr-0.5 inline" />VIP</Badge>}
            {customer.is_blocked && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-1.5"><Ban className="h-3 w-3 mr-0.5 inline" />Blocked</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {Number(customer.total_orders)} orders · ${Number(customer.lifetime_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lifetime value
            {customer.last_order_date ? ` · Last order: ${new Date(String(customer.last_order_date)).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate(`/orders?customerId=${customerId}`)}>
            <ShoppingCart className="h-4 w-4 mr-1" /> New Order
          </Button>
          {isLogistics ? null : !editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </>
          )}
        </div>
      </div>

      {/* Blocked reason banner */}
      {customer.is_blocked && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <Ban className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">This customer is blocked</p>
              <p className="text-xs text-red-600">{String(customer.blocked_reason || 'No reason given')}</p>
              {customer.blocked_at && <p className="text-xs text-muted-foreground">Blocked on {new Date(String(customer.blocked_at)).toLocaleDateString()}</p>}
            </div>
          </div>
          {!isLogistics && <Button size="sm" variant="outline" onClick={handleUnblock} disabled={unblocking}>Unblock</Button>}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders ({String(customer.total_orders)})</TabsTrigger>
          <TabsTrigger value="notes">Interaction Log</TabsTrigger>
        </TabsList>

        {/* ---- OVERVIEW ---- */}
        <TabsContent value="overview" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div className="border rounded p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Contact Info</h2>
                {!editing && !customer.is_blocked && !isLogistics && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setBlockOpen(true)}>
                    <Ban className="h-3 w-3 mr-1" /> Block
                  </Button>
                )}
              </div>
              {editing ? (
                <div className="space-y-3">
                  <div><Label className="text-xs">Full Name</Label><Input value={String(form.full_name)} onChange={e => sf('full_name')(e.target.value)} /></div>
                  <div><Label className="text-xs">Email</Label><Input value={String(form.email)} onChange={e => sf('email')(e.target.value)} /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={String(form.phone)} onChange={e => sf('phone')(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Channel</Label>
                      <Select value={String(form.preferred_channel)} onValueChange={sf('preferred_channel')}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Handle</Label><Input value={String(form.channel_handle)} onChange={e => sf('channel_handle')(e.target.value)} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!form.is_vip} onCheckedChange={sf('is_vip')} />
                    <Label className="text-xs">VIP Customer</Label>
                  </div>
                </div>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Email</dt><dd>{String(customer.email || '—')}</dd></div>
                  <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Phone</dt><dd>{String(customer.phone || '—')}</dd></div>
                  <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Channel</dt>
                    <dd className="flex items-center gap-1">
                      <ChannelBadge channel={String(customer.preferred_channel || '')} />
                      {customer.channel_handle && <span className="text-muted-foreground text-xs">{String(customer.channel_handle)}</span>}
                    </dd>
                  </div>
                  <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Customer since</dt><dd>{customer.created_at ? new Date(String(customer.created_at)).toLocaleDateString() : '—'}</dd></div>
                </dl>
              )}
            </div>

            {/* Ship-To Address */}
            <div className="border rounded p-4 space-y-3">
              <h2 className="font-semibold text-sm">Default Ship-To Address</h2>
              {editing ? (
                <div className="space-y-2">
                  <div><Label className="text-xs">Address Line 1</Label><Input value={String(form.ship_address_line1)} onChange={e => sf('ship_address_line1')(e.target.value)} /></div>
                  <div><Label className="text-xs">Address Line 2</Label><Input value={String(form.ship_address_line2)} onChange={e => sf('ship_address_line2')(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">City</Label><Input value={String(form.ship_city)} onChange={e => sf('ship_city')(e.target.value)} /></div>
                    <div><Label className="text-xs">State</Label><Input value={String(form.ship_state)} onChange={e => sf('ship_state')(e.target.value)} /></div>
                    <div><Label className="text-xs">Postal</Label><Input value={String(form.ship_postal_code)} onChange={e => sf('ship_postal_code')(e.target.value)} /></div>
                    <div><Label className="text-xs">Country</Label><Input value={String(form.ship_country)} onChange={e => sf('ship_country')(e.target.value)} /></div>
                  </div>
                </div>
              ) : (
                <div className="text-sm space-y-0.5">
                  {customer.ship_address_line1 ? (
                    <>
                      <p>{String(customer.ship_address_line1)}</p>
                      {customer.ship_address_line2 && <p>{String(customer.ship_address_line2)}</p>}
                      <p>{String(customer.ship_city || '')}{customer.ship_state ? `, ${String(customer.ship_state)}` : ''} {dbText(customer.ship_postal_code)}</p>
                      <p>{String(customer.ship_country || '')}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No address on file</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-4 space-y-2">
                <Label className="font-semibold text-sm">Notes</Label>
                <Textarea value={String(form.notes)} onChange={e => sf('notes')(e.target.value)} rows={4} />
              </div>
              {canSeeInternalNotes && (
                <div className="border rounded p-4 space-y-2">
                  <Label className="font-semibold text-sm">Internal Notes</Label>
                  <Textarea value={String(form.internal_notes)} onChange={e => sf('internal_notes')(e.target.value)} rows={4} />
                </div>
              )}
            </div>
          )}

          {!editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customer.notes && (
                <div className="border rounded p-4">
                  <p className="font-semibold text-sm mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{String(customer.notes)}</p>
                </div>
              )}
              {canSeeInternalNotes && customer.internal_notes && (
                <div className="border rounded p-4">
                  <p className="font-semibold text-sm mb-2">Internal Notes <Badge variant="outline" className="text-xs ml-1">Private</Badge></p>
                  <p className="text-sm whitespace-pre-wrap">{String(customer.internal_notes)}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ---- ORDERS ---- */}
        <TabsContent value="orders" className="pt-4">
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium">Order #</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Payment</th>
                    <th className="text-left p-3 font-medium">Channel</th>
                    <th className="text-left p-3 font-medium">Ship To</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b">
                        <td colSpan={7} className="p-3"><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                  ) : (orders as Order[]).length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No orders yet</td></tr>
                  ) : (
                    asRows<Order>(orders).map(o => (
                      <tr
                        key={String(o.id)}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => { setSelectedOrderId(Number(o.id)); setOrderDrawerOpen(true); }}
                      >
                        <td className="p-3 font-mono text-xs font-medium">{String(o.order_number)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(String(o.order_date)).toLocaleDateString()}</td>
                        <td className="p-3"><StatusBadge status={String(o.status)} /></td>
                        <td className="p-3"><PaymentBadge status={String(o.payment_status)} /></td>
                        <td className="p-3"><ChannelBadge channel={String(o.order_channel)} /></td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate">
                          {[o.ship_to_name, o.ship_address_line1, o.ship_city, o.ship_state, o.ship_country].filter(Boolean).join(', ')}
                        </td>
                        <td className="p-3 text-right font-medium">${Number(o.total_usd).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ---- NOTES ---- */}
        <TabsContent value="notes" className="pt-4">
          <NotesPanel customerId={customerId} readOnly={isLogistics} />
        </TabsContent>
      </Tabs>

      <BlockDialog customer={customer} open={blockOpen} onClose={() => setBlockOpen(false)} onDone={reloadDetail} />
      <OrderDetailDrawer
        orderId={selectedOrderId}
        open={orderDrawerOpen}
        onClose={() => { setOrderDrawerOpen(false); setSelectedOrderId(null); }}
        onRefresh={() => { reloadOrders(); reloadDetail(); }}
      />
    </div>
  );
}
