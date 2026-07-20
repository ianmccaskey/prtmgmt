import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import listParcelTemplates from '@/actions/warehouse/listParcelTemplates';
import createParcelTemplate from '@/actions/warehouse/createParcelTemplate';
import deleteParcelTemplate from '@/actions/warehouse/deleteParcelTemplate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

type ParcelTemplate = {
  id: number; warehouse_id: number; name: string;
  length_in: number; width_in: number; height_in: number; default_weight_lb: number | null;
};

const EMPTY = { name: '', length_in: '', width_in: '', height_in: '', default_weight_lb: '' };

/**
 * Self-service box template manager for one warehouse — reachable from the
 * Fulfillment tab so warehouse staff maintain their own box set without
 * needing the admin Settings page. Admins get the same dialog scoped to
 * whichever warehouse the page switcher has selected.
 */
export function BoxTemplatesDialog({ warehouseId, warehouseName, open, onClose }: {
  warehouseId: string; warehouseName: string; open: boolean; onClose: () => void;
}) {
  const [raw, loading, , reload] = useLoadAction(listParcelTemplates, [warehouseId, open ? 1 : 0], { warehouse_id: warehouseId }, { enabled: open && !!warehouseId });
  const templates = asRows<ParcelTemplate>(raw);
  const [doCreate] = useMutateAction(createParcelTemplate);
  const [doDelete] = useMutateAction(deleteParcelTemplate);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const add = async () => {
    const dims = [form.length_in, form.width_in, form.height_in].map(Number);
    if (!form.name.trim() || dims.some(d => !(d > 0))) {
      setError('Name and positive length/width/height are required.');
      return;
    }
    if (form.default_weight_lb.trim() !== '' && !(Number(form.default_weight_lb) > 0)) {
      setError('Weight must be blank or a positive number.');
      return;
    }
    setSaving(true); setError('');
    try {
      await doCreate({
        warehouse_id: Number(warehouseId),
        name: form.name.trim(),
        length_in: Number(form.length_in),
        width_in: Number(form.width_in),
        height_in: Number(form.height_in),
        default_weight_lb: form.default_weight_lb.trim(),
      });
      setForm(EMPTY);
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add box template');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    await doDelete({ id });
    reload();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-lg">
        <DialogHeader><DialogTitle>Box Templates — {warehouseName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Your warehouse&apos;s box presets, selectable when quoting Shippo labels in Mark Shipped.
          </p>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="space-y-1.5">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-sm">
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {Number(t.length_in)}×{Number(t.width_in)}×{Number(t.height_in)} in{t.default_weight_lb != null ? ` · ${Number(t.default_weight_lb)} lb` : ''}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-500" onClick={() => remove(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted-foreground">No box templates yet.</p>}
            </div>
          )}
          <div className="rounded border bg-slate-50 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">Add a box</p>
            <div><Label className="text-xs">Name *</Label><Input className="h-8" value={form.name} onChange={set('name')} placeholder='e.g. "Small box", "6-kit mailer"' /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs">L (in) *</Label><Input className="h-8" type="number" min="0" step="0.1" value={form.length_in} onChange={set('length_in')} /></div>
              <div><Label className="text-xs">W (in) *</Label><Input className="h-8" type="number" min="0" step="0.1" value={form.width_in} onChange={set('width_in')} /></div>
              <div><Label className="text-xs">H (in) *</Label><Input className="h-8" type="number" min="0" step="0.1" value={form.height_in} onChange={set('height_in')} /></div>
              <div><Label className="text-xs">Wt (lb)</Label><Input className="h-8" type="number" min="0" step="0.1" value={form.default_weight_lb} onChange={set('default_weight_lb')} placeholder="optional" /></div>
            </div>
            <Button size="sm" className="w-full sm:w-auto" onClick={add} disabled={saving}>{saving ? 'Adding…' : 'Add Box'}</Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
