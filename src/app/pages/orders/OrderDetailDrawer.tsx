import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { rows, firstRow } from '@/lib/rows';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge, PaymentBadge, SourceBadges, ChannelBadge } from './OrderBadges';
import { AlertTriangle, Check, Crown, Flag, Plus, RefreshCw, Package, Truck } from 'lucide-react';
import listUserProfiles from '@/actions/settings/listUserProfiles';
import releaseProductReservation from '@/actions/warehouse/releaseProductReservation';
import reserveProductStockFifo from '@/actions/warehouse/reserveProductStockFifo';
import getOrderItemAllocations from '@/actions/orders/getOrderItemAllocations';
import getOrderNotifications from '@/actions/orders/getOrderNotifications';
import updateOrderNotes from '@/actions/orders/updateOrderNotes';
import { OrderItemsEditor, OrderItemRow, AllocationRow } from '@/app/pages/orders/OrderItemsEditor';
import getOrderDetail from '@/actions/orders/getOrderDetail';
import getOrderItems from '@/actions/orders/getOrderItems';
import getOrderPayments from '@/actions/orders/getOrderPayments';
import getOrderShipments from '@/actions/orders/getOrderShipments';
import getOrderAuditLog from '@/actions/orders/getOrderAuditLog';
import markPaymentVerified from '@/actions/orders/markPaymentVerified';
import flagPaymentIssue from '@/actions/orders/flagPaymentIssue';
import createRefundTask from '@/actions/orders/createRefundTask';
import flagShipmentIssue from '@/actions/orders/flagShipmentIssue';
import updateOrderStatus from '@/actions/orders/updateOrderStatus';
import insertAuditLog from '@/actions/orders/insertAuditLog';
import updateOrderSalesRep from '@/actions/orders/updateOrderSalesRep';
import listSalesReps from '@/actions/orders/listSalesReps';
import updateOrderPreferredWarehouse from '@/actions/orders/updateOrderPreferredWarehouse';
import listWarehousesAction from '@/actions/warehouse/listWarehouses';

interface OrderDetailDrawerProps {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type OrderDetail = Record<string, string | number | boolean | null>;
type OrderItem = Record<string, string | number | boolean | null>;
type Payment = Record<string, string | number | boolean | null>;
type Shipment = Record<string, string | number | boolean | null>;
type AuditEntry = Record<string, string | number | null>;

// Must match the shipments_outbound.issue_flag CHECK constraint.
const ISSUE_TYPES = ['lost_in_transit', 'damaged_in_transit', 'returned_to_sender', 'stuck_in_transit', 'other'];
// Must match the order_payments.issue_type CHECK constraint.
const PAYMENT_ISSUE_TYPES = ['underpaid', 'overpaid', 'wrong_asset', 'wrong_network', 'wallet_mismatch', 'unconfirmed_onchain', 'other'];

function PaymentsPanel({ orderId, reload: parentReload }: { orderId: number; reload: () => void }) {
  const { profileId } = useAppUser();
  const [payments, loading, , reloadPay] = useLoadAction(getOrderPayments, [orderId], { orderId });
  const [verifyPayment, verifying] = useMutateAction(markPaymentVerified);
  const [flagPayment, flagging] = useMutateAction(flagPaymentIssue);
  const [flagOpen, setFlagOpen] = useState<number | null>(null);
  const [issueType, setIssueType] = useState('');
  const [issueNotes, setIssueNotes] = useState('');

  const doVerify = async (payId: number) => {
    await verifyPayment({ paymentId: payId, userId: profileId });
    reloadPay();
    parentReload();
  };

  const doFlag = async () => {
    if (!flagOpen) return;
    await flagPayment({ paymentId: flagOpen, issueType, issueNotes });
    setFlagOpen(null); setIssueType(''); setIssueNotes('');
    reloadPay();
  };

  if (loading) return <Skeleton className="h-16 w-full" />;
  const payList = rows<Payment>(payments);

  return (
    <div className="space-y-2">
      {payList.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded yet.</p>}
      {payList.map(p => (
        <div key={String(p.id)} className="border rounded-md p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium">{String(p.asset)}/{String(p.network)}</span>
            <Badge variant="outline" className={`text-xs px-1 py-0 ${p.verification_status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' : p.verification_status === 'flagged' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {String(p.verification_status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{p.amount_asset != null ? `${Number(p.amount_asset).toFixed(6)} ${String(p.asset)} · ` : ''}${Number(p.amount_usd).toFixed(2)}</p>
          {p.tx_hash && <p className="text-xs text-muted-foreground break-all">TX: {String(p.tx_hash)}</p>}
          {p.issue_type && <p className="text-xs text-red-600">Issue: {String(p.issue_type)} — {String(p.issue_notes)}</p>}
          <div className="flex gap-2 pt-1">
            {p.verification_status !== 'verified' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => doVerify(Number(p.id))} disabled={verifying}>
                <Check className="h-3 w-3 mr-1" /> Mark Verified
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setFlagOpen(Number(p.id)); setIssueType(String(p.issue_type || '')); setIssueNotes(String(p.issue_notes || '')); }}>
              <Flag className="h-3 w-3 mr-1" /> Flag Issue
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!flagOpen} onOpenChange={v => !v && setFlagOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Flag Payment Issue</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_ISSUE_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={issueNotes} onChange={e => setIssueNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(null)}>Cancel</Button>
            <Button onClick={doFlag} disabled={flagging}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RefundTaskForm({ orderId, onCreated }: { orderId: number; onCreated: () => void }) {
  const { profileId } = useAppUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', reason: '', dueDate: '', assignee: '' });
  const [doCreate, creating] = useMutateAction(createRefundTask);
  const [profiles] = useLoadAction(listUserProfiles, [], {}, { enabled: open });
  const profileOptions = rows<{ id: number; display_name: string }>(profiles);

  const submit = async () => {
    await doCreate({ orderId, userId: profileId, amountUsdOwed: Number(form.amount), reason: form.reason, assigneeUserId: form.assignee ? Number(form.assignee) : null, dueDate: form.dueDate || null });
    setOpen(false); setForm({ amount: '', reason: '', dueDate: '', assignee: '' }); onCreated();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Create Refund Task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Refund Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Amount Owed (USD)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Assignee</Label>
              <Select value={form.assignee || '_none'} onValueChange={v => setForm(f => ({ ...f, assignee: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {profileOptions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={creating || !form.amount || !form.reason}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShipmentCard({ shipment, onRefresh }: { shipment: Shipment; onRefresh: () => void }) {
  const { profileId } = useAppUser();
  const [flagOpen, setFlagOpen] = useState(false);
  const [issueFlag, setIssueFlag] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [doFlag, flagging] = useMutateAction(flagShipmentIssue);

  const doFlagSubmit = async () => {
    await doFlag({ shipmentId: shipment.id, issueFlag, issueNotes, userId: profileId });
    setFlagOpen(false); onRefresh();
  };

  return (
    <div className="border rounded-md p-3 text-sm space-y-1">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{String(shipment.origin === 'china' ? (shipment.factory_name || 'China') : (shipment.warehouse_name || 'Warehouse'))}</span>
        <Badge variant="outline" className="text-xs px-1 py-0">{String(shipment.status)}</Badge>
        {shipment.issue_flag && <Badge variant="outline" className="text-xs px-1 py-0 bg-red-50 text-red-600 border-red-200">{String(shipment.issue_flag)}</Badge>}
      </div>
      {shipment.carrier && <p className="text-muted-foreground">{String(shipment.carrier)} · {String(shipment.tracking_number || '—')}</p>}
      {shipment.shipped_date && <p className="text-xs text-muted-foreground">Shipped: {String(shipment.shipped_date)}</p>}
      {shipment.issue_notes && <p className="text-xs text-red-600">{String(shipment.issue_notes)}</p>}
      <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => { setFlagOpen(true); setIssueFlag(String(shipment.issue_flag || '')); setIssueNotes(String(shipment.issue_notes || '')); }}>
        <Flag className="h-3 w-3 mr-1" /> Flag Issue
      </Button>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Flag Shipment Issue</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Issue Type</Label>
              <Select value={issueFlag} onValueChange={setIssueFlag}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{ISSUE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={issueNotes} onChange={e => setIssueNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button onClick={doFlagSubmit} disabled={flagging || !issueFlag}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CancelOrderDialog({ orderId, orderStatus, open, onClose, onDone }: {
  orderId: number; orderStatus: string; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { profileId } = useAppUser();
  const [reason, setReason] = useState('');
  const [doUpdate, updating] = useMutateAction(updateOrderStatus);
  const [doAudit] = useMutateAction(insertAuditLog);
  const [doRelease] = useMutateAction(releaseProductReservation);

  const submit = async () => {
    const res = await doUpdate({ orderId, status: 'cancelled', cancellationReason: reason || null }) as unknown[];
    // Transition guard returned zero rows → stale drawer (order already moved
    // on); don't release reservations or write a false cancel audit.
    if (res && res.length > 0) {
      // Cancellation releases everything still in this order's reservation
      // ledger — exactly the rows it reserved, nobody else's.
      await doRelease({ order_id: orderId, product_id: null });
      await doAudit({ orderId, userId: profileId, changeType: 'status', fieldName: 'status', oldValue: orderStatus, newValue: 'cancelled', note: reason || null });
    }
    onDone(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cancel Order</DialogTitle></DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-sm text-muted-foreground">Optionally provide a cancellation reason:</p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)…" rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Go Back</Button>
          <Button variant="destructive" onClick={submit} disabled={updating}>Cancel Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDetailDrawer({ orderId, open, onClose, onRefresh }: OrderDetailDrawerProps) {
  const { profileId, isAdmin } = useAppUser();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [doUpdateStatus, updatingStatus] = useMutateAction(updateOrderStatus);
  const [doAudit] = useMutateAction(insertAuditLog);

  const [detail, detailLoading, , reloadDetail] = useLoadAction(getOrderDetail, [orderId], { orderId }, { enabled: !!orderId });
  const [items, itemsLoading, , reloadItems] = useLoadAction(getOrderItems, [orderId], { orderId }, { enabled: !!orderId });
  const [shipments, shipmentsLoading, , reloadShipments] = useLoadAction(getOrderShipments, [orderId], { orderId }, { enabled: !!orderId });
  const [auditLog, auditLoading] = useLoadAction(getOrderAuditLog, [orderId], { orderId }, { enabled: !!orderId && isAdmin });
  const [allocationsRaw, , , reloadAllocations] = useLoadAction(getOrderItemAllocations, [orderId], { orderId }, { enabled: !!orderId });
  const [notificationsRaw] = useLoadAction(getOrderNotifications, [orderId], { orderId }, { enabled: !!orderId });
  const [salesReps] = useLoadAction(listSalesReps, []);
  const [doUpdateRep] = useMutateAction(updateOrderSalesRep);
  const [warehousesRaw] = useLoadAction(listWarehousesAction, [], {});
  const [doUpdateWarehouse] = useMutateAction(updateOrderPreferredWarehouse);
  const [doSaveNotes] = useMutateAction(updateOrderNotes);
  const [doReserveDraft] = useMutateAction(reserveProductStockFifo);
  const [editingRep, setEditingRep] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  // Local mirror of a just-edited fulfillment warehouse ('' = auto) so a
  // Confirm click can't race the detail reload and reserve at the old one.
  const [whOverride, setWhOverride] = useState<string | null>(null);
  useEffect(() => { setWhOverride(null); }, [orderId]);

  const reloadAll = () => { reloadDetail(); reloadItems(); reloadShipments(); reloadAllocations(); onRefresh(); };

  const order = firstRow<OrderDetail>(detail);
  const allocations = rows<AllocationRow>(allocationsRaw);
  const notifications = rows<{ id: number; status: string }>(notificationsRaw);
  const pendingNotifications = notifications.filter(n => n.status === 'pending').length;

  if (!order && !detailLoading) return null;

  const status = order ? String(order.status) : '';
  const isReadOnly = !!order && (status === 'cancelled' || status === 'delivered');
  const isShippedish = ['partially_shipped', 'shipped', 'delivered'].includes(status);
  const shipmentList = rows<Shipment>(shipments);

  const handleStatusAction = async (next: string) => {
    const res = await doUpdateStatus({ orderId, status: next, cancellationReason: null }) as unknown[];
    if (res && res.length > 0) {
      if (next === 'confirmed') {
        // Confirming a quote starts the reservation lifecycle for its
        // warehouse lines, targeted per line: the line's own warehouse
        // (split shipments) or the order-level one when the line has none
        // (shortfall there = backorder at that warehouse).
        const orderWhParam = whOverride !== null ? whOverride : (order?.preferred_warehouse_id ? String(order.preferred_warehouse_id) : '');
        for (const it of rows<OrderItemRow>(items).filter(i => i.fulfillment_source === 'warehouse')) {
          const whParam = it.preferred_warehouse_id != null ? String(it.preferred_warehouse_id) : orderWhParam;
          await doReserveDraft({ order_id: orderId, product_id: it.product_id, quantity: Number(it.quantity), warehouse_id: whParam });
        }
      }
      await doAudit({ orderId, userId: profileId, changeType: 'status', fieldName: 'status', oldValue: status, newValue: next, note: null });
    }
    reloadAll();
  };

  const saveNotes = async () => {
    if (notesDraft == null) return;
    setSavingNotes(true);
    await doSaveNotes({ orderId, notes: notesDraft || null });
    await doAudit({ orderId, userId: profileId, changeType: 'notes', fieldName: 'notes', oldValue: null, newValue: null, note: 'Internal notes updated' });
    setSavingNotes(false);
    setNotesDraft(null);
    reloadDetail();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl p-0" side="right">
          {/* Native scroll instead of Radix ScrollArea: its display:table
              viewport lets content exceed the sheet width and clip on
              mobile; overflow-x-hidden + break-words keep everything inside. */}
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 space-y-4 break-words">
              {detailLoading ? (
                <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64" /></div>
              ) : order ? (
                <>
                  <SheetHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SheetTitle>{String(order.order_number)}</SheetTitle>
                      <StatusBadge status={String(order.status)} />
                      <PaymentBadge status={String(order.payment_status)} />
                      <ChannelBadge channel={String(order.order_channel)} />
                      {order.is_free_order && <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs px-1">FREE</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium">{String(order.customer_name)}</span>
                      {order.is_vip && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-1"><Crown className="h-3 w-3 mr-0.5 inline" />VIP</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground break-all">{String(order.customer_email || '')} · {String(order.customer_phone || '')}</p>
                    <p className="text-sm font-semibold">Total: ${Number(order.total_usd).toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-muted-foreground">Sales Rep:</span>
                      {editingRep ? (
                        <Select
                          value={order.sales_rep_user_profile_id ? String(order.sales_rep_user_profile_id) : ''}
                          onValueChange={async (v) => {
                            await doUpdateRep({ orderId, salesRepUserProfileId: v ? Number(v) : null });
                            setEditingRep(false);
                            reloadDetail();
                          }}
                        >
                          <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            {rows<{ id: number; display_name: string }>(salesReps).map(r => (
                              <SelectItem key={r.id} value={String(r.id)}>{r.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button className="font-medium text-blue-600 hover:underline" onClick={() => setEditingRep(true)}>
                          {String(order.sales_rep_name || 'Unassigned')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-muted-foreground">Fulfills from:</span>
                      {status === 'quote' ? (
                        <Select
                          value={whOverride !== null ? (whOverride || 'auto') : (order.preferred_warehouse_id ? String(order.preferred_warehouse_id) : 'auto')}
                          onValueChange={async v => {
                            setWhOverride(v === 'auto' ? '' : v);
                            await doUpdateWarehouse({ orderId, warehouseId: v === 'auto' ? null : Number(v) });
                            reloadDetail();
                          }}
                        >
                          <SelectTrigger className="h-7 w-52 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto / as set per line</SelectItem>
                            {rows<{ id: number; name: string }>(warehousesRaw).map(w => (
                              <SelectItem key={w.id} value={String(w.id)}>{w.name} (clears per-line splits)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-medium">
                          {order.preferred_warehouse_name
                            ? String(order.preferred_warehouse_name)
                            : rows<OrderItemRow>(items).some(i => i.preferred_warehouse_id != null)
                              ? 'Split (per line)'
                              : 'Auto'}
                        </span>
                      )}
                    </div>
                  </SheetHeader>

                  {/* Tracking hero — prominent once anything shipped, for copy-into-chat */}
                  {isShippedish && shipmentList.length > 0 && (
                    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Truck className="h-4 w-4" /> Tracking</p>
                        {pendingNotifications > 0 && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                            customer notification pending
                          </Badge>
                        )}
                      </div>
                      {shipmentList.map(s => (
                        <div key={String(s.id)} className="flex items-center justify-between gap-2 flex-wrap text-sm">
                          <span className="text-blue-900 min-w-0">
                            {String(s.carrier || '—')} · <span className="font-mono font-medium break-all">{String(s.tracking_number || 'no tracking')}</span>
                            <span className="text-xs text-blue-600 ml-1.5">({String(s.origin) === 'china' ? 'China' : String(s.warehouse_name || 'Warehouse')})</span>
                          </span>
                          {s.tracking_number != null && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-700"
                              onClick={() => navigator.clipboard.writeText(`${s.carrier || ''} ${s.tracking_number}`.trim())}>
                              Copy
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {status === 'quote' && (
                      ['paid', 'partial_paid'].includes(String(order.payment_status)) ? (
                        <Button size="sm" className="h-7 text-xs" disabled={updatingStatus} onClick={() => handleStatusAction('confirmed')}>Confirm Order</Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}><Button size="sm" className="h-7 text-xs" disabled>Confirm Order</Button></span>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs max-w-[220px]">Quotes confirm once a payment is verified (paid / partial paid).</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    )}
                    {status === 'shipped' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" disabled={updatingStatus} onClick={() => handleStatusAction('delivered')}>Mark Delivered</Button>
                    )}
                    {!isReadOnly && status !== 'shipped' && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setCancelOpen(true)}>Cancel Order</Button>
                    )}
                  </div>

                  <Separator />

                  <Tabs defaultValue="items">
                    <TabsList className="flex h-auto w-full flex-wrap">
                      <TabsTrigger value="items" className="flex-1 min-w-[26%] sm:min-w-0">Items</TabsTrigger>
                      <TabsTrigger value="payments" className="flex-1 min-w-[26%] sm:min-w-0">Payments</TabsTrigger>
                      <TabsTrigger value="shipments" className="flex-1 min-w-[26%] sm:min-w-0">Shipments</TabsTrigger>
                      <TabsTrigger value="notes" className="flex-1 min-w-[26%] sm:min-w-0">Notes</TabsTrigger>
                      {isAdmin && <TabsTrigger value="audit" className="flex-1 min-w-[26%] sm:min-w-0">Audit Log</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="items" className="pt-3">
                      {itemsLoading ? <Skeleton className="h-20 w-full" /> : (
                        <OrderItemsEditor
                          orderId={Number(orderId)}
                          order={order}
                          items={rows<OrderItemRow>(items)}
                          allocations={allocations}
                          isReadOnly={isReadOnly}
                          onChanged={reloadAll}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="payments" className="pt-3 space-y-3">
                      <PaymentsPanel orderId={Number(orderId)} reload={reloadAll} />
                      <RefundTaskForm orderId={Number(orderId)} onCreated={reloadAll} />
                    </TabsContent>

                    <TabsContent value="shipments" className="pt-3 space-y-2">
                      {shipmentsLoading ? <Skeleton className="h-20 w-full" /> : shipmentList.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No shipments yet.</p>
                      ) : (
                        shipmentList.map(s => <ShipmentCard key={String(s.id)} shipment={s} onRefresh={reloadShipments} />)
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">Internal notes — never shown to customers. Editable in every status.</p>
                      <Textarea
                        rows={5}
                        value={notesDraft ?? String(order.notes || '')}
                        onChange={e => setNotesDraft(e.target.value)}
                        placeholder="Internal notes about this order…"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" className="h-7 text-xs" onClick={saveNotes} disabled={savingNotes || notesDraft == null}>
                          {savingNotes ? 'Saving…' : 'Save Notes'}
                        </Button>
                      </div>
                    </TabsContent>

                    {isAdmin && (
                      <TabsContent value="audit" className="pt-3">
                        {auditLoading ? <Skeleton className="h-20 w-full" /> : (
                          <div className="space-y-2">
                            {rows<AuditEntry>(auditLog).length === 0 && <p className="text-sm text-muted-foreground">No audit entries.</p>}
                            {rows<AuditEntry>(auditLog).map((entry, i) => (
                              <div key={i} className="border-l-2 border-border pl-3 py-1 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{String(entry.actor_name || entry.changed_by_user_id)}</span>
                                  <span className="text-xs text-muted-foreground">{new Date(String(entry.changed_at)).toLocaleString()}</span>
                                </div>
                                <p className="text-muted-foreground capitalize">{String(entry.change_type).replace(/_/g, ' ')}: {String(entry.field_name || '')}</p>
                                {(entry.old_value || entry.new_value) && <p className="text-xs">{String(entry.old_value || '—')} → {String(entry.new_value || '—')}</p>}
                                {entry.note && <p className="text-xs italic text-muted-foreground">{String(entry.note)}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    )}
                  </Tabs>
                </>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CancelOrderDialog orderId={Number(orderId)} orderStatus={String(order?.status ?? '')} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={reloadAll} />
    </>
  );
}
