import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listWarehouseActivityAction from '@/actions/warehouse/listWarehouseActivity';
import applyCorrectionAtomicAction from '@/actions/warehouse/applyCorrectionAtomic';
import warehouseWriteoffAtomicAction from '@/actions/warehouse/warehouseWriteoffAtomic';
import listReservationsForInventoryRowAction from '@/actions/warehouse/listReservationsForInventoryRow';
import listInventoryAction from '@/actions/warehouse/listInventory';
import { FileUpload } from '@/components/FileUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Edit3, Trash2 } from 'lucide-react';

type ActivityRow = {
  id: number; event_at: string; event_type: string; quantity_delta: number;
  warehouse_name: string; product_name: string; sku: string; batch_number: string;
  actor_name: string; notes: string;
};
type InventoryRow = { id: number; product_name: string; sku: string; batch_number: string; batch_id: number; product_id: number; warehouse_id: number; quantity_on_hand: number; quantity_available: number };

const EVENT_TYPES = ['outbound_pick', 'receipt_delivered', 'receipt_discrepancy', 'transfer_out_initiated', 'transfer_in_received', 'transfer_cancelled', 'count_correction', 'writeoff'];

// Must match the inventory_writeoffs.reason CHECK constraint.
const WRITEOFF_REASONS = ['damaged', 'expired', 'lost', 'qc_hold', 'customer_replacement', 'other'];

type Props = { warehouseId: string; warehouseList: { id: number; name: string }[] };

export function ActivityTab({ warehouseId, warehouseList }: Props) {
  const { profileId, isLogistics, isWarehouse, assignedWarehouseId } = useAppUser();
  // Warehouse users act only on their own warehouse.
  const pickableWarehouses = warehouseList.filter(w => !isWarehouse || w.id === assignedWarehouseId);
  const [eventType, setEventType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [activity, loading, , reloadActivity] = useLoadAction(listWarehouseActivityAction, [], {
    warehouse_id: warehouseId, event_type: eventType,
    date_from: dateFrom ? `${dateFrom}T00:00:00Z` : null,
    date_to: dateTo ? `${dateTo}T23:59:59Z` : null,
  });
  const rows: ActivityRow[] = asRows(activity);

  // Correction form
  const [showCorrection, setShowCorrection] = useState(false);
  const [corrForm, setCorrForm] = useState({ warehouse_id: warehouseId || '', product_batch_key: '', new_quantity: '', reason: '' });
  const [corrSaving, setCorrSaving] = useState(false);
  const [corrInventory] = useLoadAction(listInventoryAction, [], { warehouse_id: corrForm.warehouse_id });
  const corrRows: InventoryRow[] = asRows(corrInventory);
  const selectedCorrRow = corrRows.find(r => `${r.product_id}-${r.batch_id}` === corrForm.product_batch_key);
  const [applyCorrection] = useMutateAction(applyCorrectionAtomicAction);

  // Writeoff form
  const [showWriteoff, setShowWriteoff] = useState(false);
  const [woForm, setWoForm] = useState({ warehouse_id: warehouseId || '', product_batch_key: '', quantity: '', reason: '', notes: '', evidence_url: '', evidence_file: '' });
  const [woSaving, setWoSaving] = useState(false);
  const [woInventory] = useLoadAction(listInventoryAction, [], { warehouse_id: woForm.warehouse_id });
  const woRows: InventoryRow[] = asRows(woInventory);
  const selectedWoRow = woRows.find(r => `${r.product_id}-${r.batch_id}` === woForm.product_batch_key);
  const [doWriteoff] = useMutateAction(warehouseWriteoffAtomicAction);
  const [listRowReservations] = useMutateAction(listReservationsForInventoryRowAction);
  const [woBlocked, setWoBlocked] = useState<{ order_number: string; customer_name: string; reserved_qty: number }[] | null>(null);

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrRow) return;
    setCorrSaving(true);
    // Atomic: correction record + on-hand set + count_correction log.
    await applyCorrection({ product_id: selectedCorrRow.product_id, batch_id: selectedCorrRow.batch_id, warehouse_id: selectedCorrRow.warehouse_id, new_quantity: parseInt(corrForm.new_quantity), reason: corrForm.reason, user_id: profileId });
    setCorrSaving(false);
    setShowCorrection(false);
    await reloadActivity();
  };

  const handleWriteoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWoRow || !woForm.quantity) return;
    if (woForm.reason === 'other' && !woForm.notes.trim()) { setWoBlocked(null); return; }
    setWoSaving(true);
    setWoBlocked(null);
    // Atomic + guarded: no rows returned means the write-off would cut into
    // reserved stock — surface which orders hold those reservations.
    const res = await doWriteoff({
      product_id: selectedWoRow.product_id, batch_id: selectedWoRow.batch_id, warehouse_id: selectedWoRow.warehouse_id,
      quantity: parseInt(woForm.quantity), reason: woForm.reason, notes: woForm.notes || null,
      evidence_url: woForm.evidence_url || null, evidence_file: woForm.evidence_file || null, user_id: profileId,
    }) as unknown[];
    if (!res || res.length === 0) {
      const impacted = await listRowReservations({ product_id: selectedWoRow.product_id, batch_id: selectedWoRow.batch_id, warehouse_id: selectedWoRow.warehouse_id }) as { order_number: string; customer_name: string; reserved_qty: number }[];
      setWoBlocked(impacted || []);
      setWoSaving(false);
      return;
    }
    setWoSaving(false);
    setShowWriteoff(false);
    await reloadActivity();
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        {!isLogistics && <Button size="sm" variant="outline" onClick={() => setShowCorrection(true)}><Edit3 className="h-3 w-3 mr-1" />Inventory Count Correction</Button>}
        {!isLogistics && <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setShowWriteoff(true)}><Trash2 className="h-3 w-3 mr-1" />Write-off</Button>}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-3 items-center">
            <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />Activity Log</CardTitle>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-48 h-8"><SelectValue placeholder="All event types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Time</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Event</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Product</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Batch</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Warehouse</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Δ Qty</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Actor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">{new Date(r.event_at).toLocaleString()}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{r.event_type}</Badge></td>
                    <td className="px-4 py-2 text-slate-700">{r.product_name || '—'}<div className="text-xs text-slate-400">{r.sku}</div></td>
                    <td className="px-4 py-2 font-mono text-xs">{r.batch_number || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.warehouse_name || '—'}</td>
                    <td className={`px-4 py-2 text-right font-medium ${Number(r.quantity_delta) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {Number(r.quantity_delta) > 0 ? '+' : ''}{r.quantity_delta}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.actor_name || '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No activity logs</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Correction Dialog */}
      <Dialog open={showCorrection} onOpenChange={v => !v && setShowCorrection(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Inventory Count Correction</DialogTitle></DialogHeader>
          <form onSubmit={handleCorrection} className="space-y-3">
            <div>
              <Label>Warehouse</Label>
              <Select value={corrForm.warehouse_id} onValueChange={v => setCorrForm(f => ({ ...f, warehouse_id: v, product_batch_key: '' }))} disabled={isWarehouse}>
                <SelectTrigger><SelectValue placeholder="Select warehouse…" /></SelectTrigger>
                <SelectContent>{pickableWarehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product + Batch</Label>
              <Select value={corrForm.product_batch_key} onValueChange={v => setCorrForm(f => ({ ...f, product_batch_key: v }))} disabled={!corrForm.warehouse_id}>
                <SelectTrigger><SelectValue placeholder="Select product/batch…" /></SelectTrigger>
                <SelectContent>{corrRows.map(r => <SelectItem key={`${r.product_id}-${r.batch_id}`} value={`${r.product_id}-${r.batch_id}`}>{r.product_name} · {r.batch_number} (on hand: {r.quantity_on_hand})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Actual Quantity</Label>
              <Input type="number" min={0} value={corrForm.new_quantity} onChange={e => setCorrForm(f => ({ ...f, new_quantity: e.target.value }))} required />
              {selectedCorrRow && <p className="text-xs text-slate-500 mt-0.5">Current: {selectedCorrRow.quantity_on_hand} · Delta: {parseInt(corrForm.new_quantity || '0') - selectedCorrRow.quantity_on_hand}</p>}
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={corrForm.reason} onChange={e => setCorrForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Physical count discrepancy" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCorrection(false)}>Cancel</Button>
              <Button type="submit" disabled={corrSaving || !corrForm.product_batch_key}>{corrSaving ? 'Saving…' : 'Apply Correction'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Writeoff Dialog */}
      <Dialog open={showWriteoff} onOpenChange={v => !v && setShowWriteoff(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Inventory Write-off</DialogTitle></DialogHeader>
          <form onSubmit={handleWriteoff} className="space-y-3">
            <div>
              <Label>Warehouse</Label>
              <Select value={woForm.warehouse_id} onValueChange={v => setWoForm(f => ({ ...f, warehouse_id: v, product_batch_key: '' }))} disabled={isWarehouse}>
                <SelectTrigger><SelectValue placeholder="Select warehouse…" /></SelectTrigger>
                <SelectContent>{pickableWarehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product + Batch</Label>
              <Select value={woForm.product_batch_key} onValueChange={v => setWoForm(f => ({ ...f, product_batch_key: v }))} disabled={!woForm.warehouse_id}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{woRows.map(r => <SelectItem key={`${r.product_id}-${r.batch_id}`} value={`${r.product_id}-${r.batch_id}`}>{r.product_name} · {r.batch_number} ({r.quantity_available} avail)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qty to Write-off</Label>
                <Input type="number" min={1} max={selectedWoRow?.quantity_available} value={woForm.quantity} onChange={e => setWoForm(f => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={woForm.reason} onValueChange={v => setWoForm(f => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{WRITEOFF_REASONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {woForm.reason === 'other' && <div><Label>Notes (required)</Label><Textarea value={woForm.notes} onChange={e => setWoForm(f => ({ ...f, notes: e.target.value }))} rows={2} required /></div>}
            <div><Label>Evidence URL</Label><Input type="url" placeholder="https://…" value={woForm.evidence_url} onChange={e => setWoForm(f => ({ ...f, evidence_url: e.target.value }))} /></div>
            <div>
              <Label>Or upload evidence</Label>
              <FileUpload accept="image/*,.pdf" label={woForm.evidence_file ? 'Replace evidence file' : 'Upload evidence'} onUploaded={url => setWoForm(f => ({ ...f, evidence_file: url }))} />
              {woForm.evidence_file && <p className="text-xs text-green-600">Evidence file attached ✓</p>}
            </div>
            {woBlocked && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 space-y-1">
                <p className="font-medium">Blocked: the write-off couldn't be applied.</p>
                {woBlocked.length === 0
                  ? <p>Available stock is lower than requested — the row may have changed since this list loaded (or reserved seed stock has no ledgered orders). Reload the tab; for record-keeping errors use a count correction instead.</p>
                  : (<>
                      <p>It would cut into stock reserved for these orders — release them first:</p>
                      {woBlocked.map(o => <p key={o.order_number}>• {o.order_number} — {o.customer_name} ({o.reserved_qty} kits reserved)</p>)}
                    </>)}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowWriteoff(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={woSaving || !woForm.product_batch_key || !woForm.quantity || !woForm.reason}>{woSaving ? 'Processing…' : 'Write-off'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
