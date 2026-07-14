import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, PaymentBadge, SourceBadges, ChannelBadge } from './OrderBadges';
import { AlertTriangle, Check, Crown, Flag, Plus, RefreshCw, Package, Truck } from 'lucide-react';
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

const ISSUE_TYPES = ['lost', 'damaged', 'returned', 'stuck', 'other'];

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
  const payList = payments as Payment[];

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
          <p className="text-muted-foreground">{Number(p.amount_asset).toFixed(6)} {String(p.asset)} · ${Number(p.amount_usd).toFixed(2)}</p>
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
                  <SelectItem value="wrong_amount">Wrong Amount</SelectItem>
                  <SelectItem value="invalid_tx">Invalid TX</SelectItem>
                  <SelectItem value="not_received">Not Received</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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

  const submit = async () => {
    await doCreate({ orderId, userId: profileId, amountUsdOwed: Number(form.amount), reason: form.reason, assigneeUserId: form.assignee || null, dueDate: form.dueDate || null });
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
            <div><Label>Assignee User ID</Label><Input placeholder="user@example.com" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} /></div>
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

function CancelOrderDialog({ orderId, open, onClose, onDone }: { orderId: number; open: boolean; onClose: () => void; onDone: () => void }) {
  const { profileId } = useAppUser();
  const [reason, setReason] = useState('');
  const [doUpdate, updating] = useMutateAction(updateOrderStatus);
  const [doAudit] = useMutateAction(insertAuditLog);

  const submit = async () => {
    await doUpdate({ orderId, status: 'cancelled', cancellationReason: reason || null });
    await doAudit({ orderId, userId: profileId, changeType: 'status_change', fieldName: 'status', oldValue: null, newValue: 'cancelled', note: reason || null });
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
  const [salesReps] = useLoadAction(listSalesReps, []);
  const [doUpdateRep] = useMutateAction(updateOrderSalesRep);
  const [editingRep, setEditingRep] = useState(false);

  const reloadAll = () => { reloadDetail(); reloadItems(); reloadShipments(); onRefresh(); };

  const order = (detail as OrderDetail[])[0];

  if (!order && !detailLoading) return null;

  const isReadOnly = order && (String(order.status) === 'cancelled' || String(order.status) === 'delivered');

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl p-0" side="right">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
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
                    <p className="text-sm text-muted-foreground">{String(order.customer_email || '')} · {String(order.customer_phone || '')}</p>
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
                            {((salesReps as { id: number; display_name: string }[]) || []).map(r => (
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
                  </SheetHeader>

                  {!isReadOnly && (
                    <div className="flex gap-2 flex-wrap">
                      {String(order.status) !== 'cancelled' && (
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setCancelOpen(true)}>Cancel Order</Button>
                      )}
                    </div>
                  )}

                  <Separator />

                  <Tabs defaultValue="items">
                    <TabsList className="w-full">
                      <TabsTrigger value="items" className="flex-1">Items</TabsTrigger>
                      <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
                      <TabsTrigger value="shipments" className="flex-1">Shipments</TabsTrigger>
                      {isAdmin && <TabsTrigger value="audit" className="flex-1">Audit Log</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="items" className="pt-3 space-y-2">
                      {itemsLoading ? <Skeleton className="h-20 w-full" /> : (items as OrderItem[]).map(item => (
                        <div key={String(item.id)} className="border rounded-md p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{String(item.product_name)}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{String(item.product_sku)}</span>
                            </div>
                            {item.is_shipped && <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200">Shipped</Badge>}
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Qty: {Number(item.quantity)} · @${Number(item.unit_price_usd).toFixed(2)}</span>
                            <span className="font-medium text-foreground">${Number(item.line_total_usd).toFixed(2)}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs px-1 py-0 ${item.fulfillment_source === 'warehouse' ? 'text-blue-600 border-blue-200' : 'text-purple-600 border-purple-200'}`}>
                            {item.fulfillment_source === 'warehouse' ? 'Warehouse' : 'China Direct'}
                          </Badge>
                        </div>
                      ))}

                      <Separator />
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Ship To</span></div>
                        <p>{String(order.ship_to_name || '')} · {String(order.ship_address_line1 || '')}, {String(order.ship_city || '')} {String(order.ship_state || '')} {String(order.ship_postal_code || '')}, {String(order.ship_country || '')}</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="payments" className="pt-3 space-y-3">
                      <PaymentsPanel orderId={Number(orderId)} reload={reloadAll} />
                      <RefundTaskForm orderId={Number(orderId)} onCreated={reloadAll} />
                    </TabsContent>

                    <TabsContent value="shipments" className="pt-3 space-y-2">
                      {shipmentsLoading ? <Skeleton className="h-20 w-full" /> : (shipments as Shipment[]).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No shipments yet.</p>
                      ) : (
                        (shipments as Shipment[]).map(s => <ShipmentCard key={String(s.id)} shipment={s} onRefresh={reloadShipments} />)
                      )}
                    </TabsContent>

                    {isAdmin && (
                      <TabsContent value="audit" className="pt-3">
                        {auditLoading ? <Skeleton className="h-20 w-full" /> : (
                          <div className="space-y-2">
                            {(auditLog as AuditEntry[]).length === 0 && <p className="text-sm text-muted-foreground">No audit entries.</p>}
                            {(auditLog as AuditEntry[]).map((entry, i) => (
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
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <CancelOrderDialog orderId={Number(orderId)} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={reloadAll} />
    </>
  );
}
