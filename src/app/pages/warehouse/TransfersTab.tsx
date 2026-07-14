import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listTransfersAction from '@/actions/warehouse/listTransfers';
import createTransferAction from '@/actions/warehouse/createTransfer';
import deductSourceInventoryAction from '@/actions/warehouse/deductSourceInventory';
import markTransferReceivedAction from '@/actions/warehouse/markTransferReceived';
import upsertDestInventoryAction from '@/actions/warehouse/upsertDestInventory';
import listInventoryAction from '@/actions/warehouse/listInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle } from 'lucide-react';

type Transfer = {
  id: number; product_name: string; sku: string; batch_number: string; quantity: number;
  status: string; source_warehouse_name: string; destination_warehouse_name: string;
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
  const { profileId } = useAppUser();
  const [statusFilter, setStatusFilter] = useState('initiated');
  const [transfers, loading, , reload] = useLoadAction(listTransfersAction, [], { status: statusFilter, warehouse_id: warehouseId });
  const rows: Transfer[] = Array.isArray(transfers) ? transfers : [];

  const [showNew, setShowNew] = useState(false);
  const [showReceive, setShowReceive] = useState<Transfer | null>(null);
  const [receiveNote, setReceiveNote] = useState('');
  const [receiveSaving, setReceiveSaving] = useState(false);

  const [newForm, setNewForm] = useState({ source_warehouse_id: '', destination_warehouse_id: '', product_batch_key: '', quantity: '', notes: '' });
  const [newSaving, setNewSaving] = useState(false);

  const [sourceInventory] = useLoadAction(listInventoryAction, [], { warehouse_id: newForm.source_warehouse_id });
  const sourceRows: InventoryRow[] = Array.isArray(sourceInventory) ? sourceInventory : [];

  const [createTransfer] = useMutateAction(createTransferAction);
  const [deductSource] = useMutateAction(deductSourceInventoryAction);
  const [markReceived] = useMutateAction(markTransferReceivedAction);
  const [upsertDest] = useMutateAction(upsertDestInventoryAction);

  const selectedInventoryRow = sourceRows.find(r => `${r.product_id}-${r.batch_id}` === newForm.product_batch_key);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryRow) return;
    setNewSaving(true);
    await createTransfer({
      product_id: selectedInventoryRow.product_id,
      batch_id: selectedInventoryRow.batch_id,
      quantity: parseInt(newForm.quantity),
      source_warehouse_id: parseInt(newForm.source_warehouse_id),
      destination_warehouse_id: parseInt(newForm.destination_warehouse_id),
      notes: newForm.notes || null,
      user_id: profileId,
    });
    await deductSource({ product_id: selectedInventoryRow.product_id, batch_id: selectedInventoryRow.batch_id, warehouse_id: parseInt(newForm.source_warehouse_id), quantity: parseInt(newForm.quantity) });
    setNewSaving(false);
    setShowNew(false);
    setNewForm({ source_warehouse_id: '', destination_warehouse_id: '', product_batch_key: '', quantity: '', notes: '' });
    await reload();
  };

  const handleMarkReceived = async (t: Transfer) => {
    setReceiveSaving(true);
    await markReceived({ id: t.id, user_id: profileId, notes: receiveNote || null });
    const inv = sourceRows.find(r => r.batch_number === t.batch_number);
    if (inv) {
      await upsertDest({ product_id: inv.product_id, batch_id: inv.batch_id, warehouse_id: inv.warehouse_id, quantity: t.quantity });
    }
    setReceiveSaving(false);
    setShowReceive(null);
    setReceiveNote('');
    await reload();
  };

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
              <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3 w-3 mr-1" />New Transfer</Button>
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
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReceive(t)}>
                          <CheckCircle className="h-3 w-3 mr-1" />Receive
                        </Button>
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
                <p><span className="text-slate-500">Product:</span> <strong>{showReceive.product_name}</strong></p>
                <p><span className="text-slate-500">Qty:</span> <strong>{showReceive.quantity} kits</strong></p>
                <p><span className="text-slate-500">From:</span> {showReceive.source_warehouse_name} → {showReceive.destination_warehouse_name}</p>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={receiveNote} onChange={e => setReceiveNote(e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReceive(null)}>Cancel</Button>
                <Button disabled={receiveSaving} onClick={() => handleMarkReceived(showReceive)}>
                  {receiveSaving ? 'Saving…' : 'Confirm Received'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
