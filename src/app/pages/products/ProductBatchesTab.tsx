import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useNavigate } from 'react-router-dom';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listBatchesAction from '@/actions/batches/listBatches';
import createBatchAction from '@/actions/batches/createBatch';
import listFactoriesAction from '@/actions/products/listFactories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ExternalLink } from 'lucide-react';

type Batch = {
  id: number; batch_number: string; factory_name: string; manufacture_date: string;
  quantity_produced: number; net_content_mg: number | null; qty_remaining: number; cost_override: number; standard_cost: number;
  qc_status: string; overall_purity_pct: number; coa_url: string; notes: string;
};

const QC_STATUS_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  quarantine: 'bg-orange-100 text-orange-700',
};

type Props = { productId: number; productName: string; hasExistingBatches: boolean };

export function ProductBatchesTab({ productId, productName, hasExistingBatches }: Props) {
  const { isAdmin, isLogistics } = useAppUser();
  const seesCosts = isAdmin || isLogistics;
  const navigate = useNavigate();
  const [batches, loading, , reload] = useLoadAction(listBatchesAction, [], { product_id: String(productId) });
  const [factories] = useLoadAction(listFactoriesAction, [], {});
  const [createBatch] = useMutateAction(createBatchAction);
  const rows: Batch[] = asRows(batches);
  const factoryList: { id: number; name: string }[] = asRows(factories);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ batch_number: '', factory_id: '', manufacture_date: '', quantity_produced: '', net_content_mg: '', cost_override: '', qc_status: 'pending', coa_url: '', overall_purity_pct: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createBatch({
      product_id: productId,
      batch_number: form.batch_number,
      factory_id: form.factory_id ? parseInt(form.factory_id) : null,
      manufacture_date: form.manufacture_date || null,
      quantity_produced: parseInt(form.quantity_produced) || 0,
      net_content_mg: form.net_content_mg ? parseFloat(form.net_content_mg) : null,
      cost_override: form.cost_override ? parseFloat(form.cost_override) : null,
      qc_status: form.qc_status,
      coa_url: form.coa_url || null,
      overall_purity_pct: form.overall_purity_pct ? parseFloat(form.overall_purity_pct) : null,
      notes: form.notes || null,
    });
    setSaving(false);
    setShowNew(false);
    setForm({ batch_number: '', factory_id: '', manufacture_date: '', quantity_produced: '', net_content_mg: '', cost_override: '', qc_status: 'pending', coa_url: '', overall_purity_pct: '', notes: '' });
    await reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Batches for {productName}</CardTitle>
            {!isLogistics && <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3 w-3 mr-1" />Add Batch</Button>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Batch #</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Factory</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Mfg Date</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Produced</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Net (mg)</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Remaining</th>
                  {seesCosts && <th className="text-right px-4 py-2 font-medium text-slate-600">Cost</th>}
                  <th className="text-left px-4 py-2 font-medium text-slate-600">QC</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Purity</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">CoA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(b => (
                  <tr key={b.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/batches/${b.id}`)}>
                    <td className="px-4 py-2 font-mono font-medium text-blue-600">{b.batch_number}</td>
                    <td className="px-4 py-2 text-slate-600">{b.factory_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-right">{b.quantity_produced}</td>
                    <td className="px-4 py-2 text-right">{b.net_content_mg != null ? Number(b.net_content_mg) : '—'}</td>
                    <td className="px-4 py-2 text-right">{b.qty_remaining}</td>
                    {seesCosts && <td className="px-4 py-2 text-right">${Number(b.cost_override ?? b.standard_cost).toFixed(2)}</td>}
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QC_STATUS_COLORS[b.qc_status] || 'bg-slate-100 text-slate-600'}`}>{b.qc_status}</span></td>
                    <td className="px-4 py-2 text-slate-600">{b.overall_purity_pct != null ? `${b.overall_purity_pct}%` : '—'}</td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      {b.coa_url ? <a href={b.coa_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline"><ExternalLink className="h-3 w-3" /></a> : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-slate-400">No batches yet</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={v => !v && setShowNew(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Batch</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Batch Number *</Label><Input value={form.batch_number} onChange={e => set('batch_number', e.target.value)} required /></div>
              <div>
                <Label>Factory</Label>
                <Select value={form.factory_id} onValueChange={v => set('factory_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{factoryList.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Manufacture Date</Label><Input type="date" value={form.manufacture_date} onChange={e => set('manufacture_date', e.target.value)} /></div>
              <div><Label>Qty Produced</Label><Input type="number" value={form.quantity_produced} onChange={e => set('quantity_produced', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Net Content (mg)</Label><Input type="number" step="0.01" value={form.net_content_mg} onChange={e => set('net_content_mg', e.target.value)} placeholder="e.g. 5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>QC Status</Label>
                <Select value={form.qc_status} onValueChange={v => set('qc_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="quarantine">Quarantined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Overall Purity %</Label><Input type="number" step="0.01" value={form.overall_purity_pct} onChange={e => set('overall_purity_pct', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {isAdmin && <div><Label>Cost Override (USD)</Label><Input type="number" step="0.01" placeholder="Leave blank = standard cost" value={form.cost_override} onChange={e => set('cost_override', e.target.value)} /></div>}
              <div><Label>CoA URL</Label><Input type="url" placeholder="https://…" value={form.coa_url} onChange={e => set('coa_url', e.target.value)} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Batch'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
