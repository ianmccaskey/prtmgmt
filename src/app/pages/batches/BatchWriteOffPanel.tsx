import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getBatchInventoryAction from '@/actions/batches/getBatchInventory';
import warehouseWriteoffAtomicAction from '@/actions/warehouse/warehouseWriteoffAtomic';
import { FileUpload } from '@/components/FileUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

type Batch = { id: number; product_id: number; batch_number: string; qty_remaining: number };
type InventoryRow = { id: number; warehouse_name: string; warehouse_id: number; quantity_on_hand: number; quantity_reserved: number; quantity_available: number };

// Must match the inventory_writeoffs.reason CHECK constraint.
const WRITEOFF_REASONS = ['damaged', 'expired', 'lost', 'qc_hold', 'customer_replacement', 'other'];

export function BatchWriteOffPanel({ batch, onRefresh }: { batch: Batch; onRefresh: () => void }) {
  const { profileId, isWarehouse, assignedWarehouseId } = useAppUser();
  const [inventory, , , reloadInv] = useLoadAction(getBatchInventoryAction, [], { batch_id: batch.id });
  const [doWriteoff] = useMutateAction(warehouseWriteoffAtomicAction);

  const allInvRows: InventoryRow[] = asRows(inventory);
  // Warehouse users act only on their own warehouse — the allowed set
  // drives options, the selected-row lookup, AND the submit validation.
  const invRows = allInvRows.filter(r => !isWarehouse || r.warehouse_id === assignedWarehouseId);

  const [form, setForm] = useState({
    warehouse_id: '', quantity: '', reason: '', notes: '', evidence_url: '', evidence_file: '',
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const selectedWarehouse = invRows.find(r => String(r.warehouse_id) === form.warehouse_id);
  const qty = parseInt(form.quantity) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.warehouse_id || !qty || !form.reason) return;
    // Stale/foreign warehouse id can't slip through to the mutation.
    if (!invRows.some(r => String(r.warehouse_id) === form.warehouse_id)) return;
    if (form.reason === 'other' && !form.notes.trim()) {
      alert('Notes are required when reason is "other".');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setBlocked(false);
    // Atomic + guarded: writeoff record + inventory decrement + activity log;
    // zero rows means it would cut into reserved stock.
    const res = await doWriteoff({
      product_id: batch.product_id,
      batch_id: batch.id,
      warehouse_id: parseInt(form.warehouse_id),
      quantity: qty,
      reason: form.reason,
      notes: form.notes || null,
      evidence_url: form.evidence_url || null,
      evidence_file: form.evidence_file || null,
      user_id: profileId,
    }) as unknown[];
    setSaving(false);
    if (!res || res.length === 0) {
      setBlocked(true);
      reloadInv(); // refresh so the panel shows the quantities that caused the block
      return;
    }
    setShowConfirm(false);
    setForm({ warehouse_id: '', quantity: '', reason: '', notes: '', evidence_url: '', evidence_file: '' });
    reloadInv();
    onRefresh();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" /> Write-off / Destroy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Warehouse *</Label>
              <Select value={form.warehouse_id} onValueChange={v => set('warehouse_id', v)} required>
                <SelectTrigger><SelectValue placeholder="Select warehouse…" /></SelectTrigger>
                <SelectContent>
                  {invRows.map(r => (
                    <SelectItem key={r.warehouse_id} value={String(r.warehouse_id)}>
                      {r.warehouse_name} ({r.quantity_available} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity to Write-off *</Label>
              <Input
                type="number" min={1} max={selectedWarehouse?.quantity_available ?? undefined}
                value={form.quantity} onChange={e => set('quantity', e.target.value)} required
              />
              {selectedWarehouse && <p className="text-xs text-slate-500 mt-1">{selectedWarehouse.quantity_available} available in this warehouse</p>}
            </div>
          </div>

          <div>
            <Label>Reason *</Label>
            <Select value={form.reason} onValueChange={v => set('reason', v)} required>
              <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
              <SelectContent>
                {WRITEOFF_REASONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.reason === 'other' && (
            <div>
              <Label>Notes (required for "other") *</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} required />
            </div>
          )}
          {form.reason && form.reason !== 'other' && (
            <div>
              <Label>Additional Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label>Evidence URL (optional)</Label>
              <Input type="url" placeholder="https://…" value={form.evidence_url} onChange={e => set('evidence_url', e.target.value)} />
            </div>
            <div>
              <Label>Or upload evidence (photo/report)</Label>
              <FileUpload accept="image/*,.pdf" label={form.evidence_file ? 'Replace evidence file' : 'Upload evidence'} onUploaded={url => set('evidence_file', url)} />
              {form.evidence_file && <p className="text-xs text-green-600 mt-0.5">Evidence file attached ✓</p>}
            </div>
          </div>

          <Button type="submit" variant="destructive" disabled={!form.warehouse_id || !qty || !form.reason}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Review Write-off
          </Button>
        </form>

        {/* Confirm Dialog */}
        <Dialog open={showConfirm} onOpenChange={v => !v && setShowConfirm(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirm Write-off</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <p className="font-medium">This will permanently decrement inventory.</p>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-slate-500">Batch:</span> <strong>{batch.batch_number}</strong></p>
                <p><span className="text-slate-500">Warehouse:</span> <strong>{selectedWarehouse?.warehouse_name}</strong></p>
                <p><span className="text-slate-500">Quantity:</span> <strong className="text-red-600">{qty} kits</strong></p>
                <p><span className="text-slate-500">Reason:</span> <strong>{form.reason}</strong></p>
                {form.notes && <p><span className="text-slate-500">Notes:</span> {form.notes}</p>}
              </div>
              <p className="text-sm text-slate-600">
                Inventory will be decremented: {selectedWarehouse?.quantity_on_hand} → {(selectedWarehouse?.quantity_on_hand ?? 0) - qty} on hand
              </p>
              {blocked && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                  Blocked: this write-off would cut into reserved stock (or stock changed). Release the impacted orders first — see the Warehouse Activity tab for details.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button variant="destructive" disabled={saving} onClick={handleConfirm}>
                  {saving ? 'Processing…' : 'Confirm Write-off'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
