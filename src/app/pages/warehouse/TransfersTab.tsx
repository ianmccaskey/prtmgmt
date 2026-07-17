import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listTransfersAction from '@/actions/warehouse/listTransfers';
import createTransferAtomicAction from '@/actions/warehouse/createTransferAtomic';
import receiveTransferAtomicAction from '@/actions/warehouse/receiveTransferAtomic';
import cancelTransferAtomicAction from '@/actions/warehouse/cancelTransferAtomic';
import recordTransferLossWriteoffAction from '@/actions/warehouse/recordTransferLossWriteoff';
import listInventoryAction from '@/actions/warehouse/listInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type Transfer = {
  id: number; product_id: number; batch_id: number; product_name: string; sku: string;
  batch_number: string; quantity: number;
  status: string; source_warehouse_name: string; source_warehouse_id: number;
  destination_warehouse_name: string; destination_warehouse_id: number;
  initiated_at: string; received_at: string; notes: string; days_in_transit: number;
};
type InventoryRow = { id: number; product_name: string; sku: string; batch_number: string; batch_id: number; product_id: number; warehouse_id: number; quantity_available: number };

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

type Props = { warehouseId: string; warehouseList: { id: number; name: string; is_active?: boolean }[] };

export function TransfersTab({ warehouseId, warehouseList }: Props) {
  const { profileId, isLogistics } = useAppUser();
  const [statusFilter, setStatusFilter] = useState('initiated');
  const [transfers, loading, , reload] = useLoadAction(listTransfersAction, [], { status: statusFilter, warehouse_id: warehouseId });
  const rows: Transfer[] = asRows(transfers);

  const [showNew, setShowNew] = useState(false);
  const [showReceive, setShowReceive] = useState<Transfer | null>(null);
  const [showCancel, setShowCancel] = useState<Transfer | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNote, setReceiveNote] = useState('');
  const [writeOffMissing, setWriteOffMissing] = useState(true);
  const [cancelNote, setCancelNote] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  const [newForm, setNewForm] = useState({ source_warehouse_id: '', destination_warehouse_id: '', product_batch_key: '', quantity: '', notes: '' });
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState('');

  const [sourceInventory] = useLoadAction(listInventoryAction, [newForm.source_warehouse_id], { warehouse_id: newForm.source_warehouse_id });
  const sourceRows: InventoryRow[] = asRows(sourceInventory);

  const [createTransfer] = useMutateAction(createTransferAtomicAction);
  const [receiveTransfer] = useMutateAction(receiveTransferAtomicAction);
  const [cancelTransfer] = useMutateAction(cancelTransferAtomicAction);
  const [recordLoss] = useMutateAction(recordTransferLossWriteoffAction);

  const selectedInventoryRow = sourceRows.find(r => `${r.product_id}-${r.batch_id}` === newForm.product_batch_key);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryRow) return;
    setNewSaving(true);
    setNewError('');
    // Atomic + guarded: transfer row + source deduction + activity log in one
    // statement, only when the source still has enough available stock.
    const res = await createTransfer({
      product_id: selectedInventoryRow.product_id,
      batch_id: selectedInventoryRow.batch_id,
      quantity: parseInt(newForm.quantity),
      source_warehouse_id: parseInt(newForm.source_warehouse_id),
      destination_warehouse_id: parseInt(newForm.destination_warehouse_id),
      notes: newForm.notes || null,
      user_id: profileId,
    }) as unknown[];
    setNewSaving(false);
    if (!res || res.length === 0) {
      setNewError('Not enough available stock at the source warehouse — it may have changed since this list loaded.');
      return;
    }
    setShowNew(false);
    setNewForm({ source_warehouse_id: '', destination_warehouse_id: '', product_batch_key: '', quantity: '', notes: '' });
    await reload();
  };

  const openReceive = (t: Transfer) => {
    setShowReceive(t);
    setReceiveQty(String(t.quantity));
    setReceiveNote('');
    setWriteOffMissing(true);
  };

  const handleMarkReceived = async (t: Transfer) => {
    const received = Math.max(0, Math.min(parseInt(receiveQty) || 0, t.quantity));
    const missing = t.quantity - received;
    if (missing > 0 && !receiveNote.trim()) return; // discrepancy needs a note
    setActionSaving(true);
    const res = await receiveTransfer({ id: t.id, user_id: profileId, received_quantity: received, notes: receiveNote || null }) as unknown[];
    // Guarded receive returned zero rows → transfer was no longer 'initiated'
    // (double-click / concurrent action); skip the loss write-off too.
    if ((!res || res.length === 0)) {
      setActionSaving(false);
      setShowReceive(null);
      await reload();
      return;
    }
    if (missing > 0 && writeOffMissing) {
      await recordLoss({
        product_id: t.product_id, batch_id: t.batch_id, warehouse_id: t.source_warehouse_id,
        quantity: missing, user_id: profileId,
        notes: `Lost in transfer #${t.id} (${t.source_warehouse_name} → ${t.destination_warehouse_name}): received ${received} of ${t.quantity}. ${receiveNote}`.trim(),
      });
    }
    setActionSaving(false);
    setShowReceive(null);
    await reload();
  };

  const handleCancel = async (t: Transfer) => {
    setActionSaving(true);
    await cancelTransfer({ id: t.id, user_id: profileId, notes: cancelNote || null });
    setActionSaving(false);
    setShowCancel(null);
    setCancelNote('');
    await reload();
  };

  const receivedShort = showReceive ? (parseInt(receiveQty) || 0) < showReceive.quantity : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Inter-Warehouse Transfers</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {!isLogistics && <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3 w-3 mr-1" />New Transfer</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Product / Batch</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">From → To</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Initiated</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Days</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{t.product_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.batch_number || '—'} · {t.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{t.source_warehouse_name} → {t.destination_warehouse_name}</td>
                    <td className="px-4 py-2 text-right font-medium">{t.quantity}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{new Date(t.initiated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">{t.received_at ? '—' : Math.round(Number(t.days_in_transit))}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>{t.status}</span></td>
                    <td className="px-4 py-2">
                      {t.status === 'initiated' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openReceive(t)}>
                            <CheckCircle className="h-3 w-3 mr-1" />Receive
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => setShowCancel(t)}>
                            <XCircle className="h-3 w-3 mr-1" />Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">No transfers</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* New Transfer Dialog */}
      <Dialog open={showNew} onOpenChange={v => !v && setShowNew(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Inter-Warehouse Transfer</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTransfer} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source Warehouse</Label>
                <Select value={newForm.source_warehouse_id} onValueChange={v => setNewForm(f => ({ ...f, source_warehouse_id: v, product_batch_key: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{warehouseList.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination Warehouse</Label>
                <Select value={newForm.destination_warehouse_id} onValueChange={v => setNewForm(f => ({ ...f, destination_warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{warehouseList.filter(w => String(w.id) !== newForm.source_warehouse_id).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Product + Batch</Label>
              <Select value={newForm.product_batch_key} onValueChange={v => setNewForm(f => ({ ...f, product_batch_key: v }))} disabled={!newForm.source_warehouse_id}>
                <SelectTrigger><SelectValue placeholder="Select product/batch…" /></SelectTrigger>
                <SelectContent>
                  {sourceRows.map(r => <SelectItem key={`${r.product_id}-${r.batch_id}`} value={`${r.product_id}-${r.batch_id}`}>{r.product_name} · {r.batch_number} ({r.quantity_available} avail)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} max={selectedInventoryRow?.quantity_available} value={newForm.quantity} onChange={e => setNewForm(f => ({ ...f, quantity: e.target.value }))} required />
              {selectedInventoryRow && <p className="text-xs text-slate-500 mt-0.5">{selectedInventoryRow.quantity_available} available</p>}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {newError && <p className="text-sm text-red-600">{newError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" disabled={newSaving || !newForm.product_batch_key}>{newSaving ? 'Creating…' : 'Create Transfer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark Received Dialog */}
      {showReceive && (
        <Dialog open onOpenChange={() => setShowReceive(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark Transfer Received</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 rounded p-3 text-sm space-y-1">
                <p><span className="text-slate-500">Product:</span> <strong>{showReceive.product_name}</strong> <span className="text-slate-400 font-mono text-xs">{showReceive.batch_number}</span></p>
                <p><span className="text-slate-500">Sent:</span> <strong>{showReceive.quantity} kits</strong></p>
                <p><span className="text-slate-500">Route:</span> {showReceive.source_warehouse_name} → {showReceive.destination_warehouse_name}</p>
              </div>
              <div>
                <Label>Received Quantity *</Label>
                <Input type="number" min={0} max={showReceive.quantity} value={receiveQty} onChange={e => setReceiveQty(e.target.value)} />
              </div>
              {receivedShort && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Short by {showReceive.quantity - (parseInt(receiveQty) || 0)} kits — a discrepancy will be recorded. Note required.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-amber-800">
                    <input type="checkbox" checked={writeOffMissing} onChange={e => setWriteOffMissing(e.target.checked)} />
                    Write off missing kits as lost
                  </label>
                </div>
              )}
              <div>
                <Label>Notes {receivedShort ? '(required)' : '(optional)'}</Label>
                <Textarea value={receiveNote} onChange={e => setReceiveNote(e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReceive(null)}>Cancel</Button>
                <Button disabled={actionSaving || receiveQty === '' || (receivedShort && !receiveNote.trim())} onClick={() => handleMarkReceived(showReceive)}>
                  {actionSaving ? 'Saving…' : 'Confirm Received'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Transfer Dialog */}
      {showCancel && (
        <Dialog open onOpenChange={() => setShowCancel(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cancel Transfer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {showCancel.quantity} kits of <strong>{showCancel.product_name}</strong> will be returned to {showCancel.source_warehouse_name}.
              </p>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCancel(null)}>Go Back</Button>
                <Button variant="destructive" disabled={actionSaving} onClick={() => handleCancel(showCancel)}>
                  {actionSaving ? 'Cancelling…' : 'Cancel Transfer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
