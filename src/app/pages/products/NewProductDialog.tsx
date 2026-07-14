import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import createProductAction from '@/actions/products/createProduct';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const CATEGORIES = ['research peptide', 'cosmetic peptide', 'blend', 'accessory'];

type Props = {
  open: boolean;
  onClose: () => void;
  factories: { id: number; name: string }[];
  onCreated: (id: number) => void;
};

export function NewProductDialog({ open, onClose, factories, onCreated }: Props) {
  const [form, setForm] = useState({
    sku: '', name: '', description: '', category: '', vial_size_ml: '', vials_per_unit: '1',
    list_price: '', standard_cost: '', available_warehouse: true, available_china_direct: false,
    factory_id: '', low_stock_threshold: '10',
  });
  const [mutate, saving, error] = useMutateAction(createProductAction);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.name) return;
    const result = await mutate({
      ...form,
      vial_size_ml: parseFloat(form.vial_size_ml) || 0,
      vials_per_unit: parseInt(form.vials_per_unit) || 1,
      list_price: parseFloat(form.list_price) || 0,
      standard_cost: parseFloat(form.standard_cost) || 0,
      factory_id: form.factory_id ? parseInt(form.factory_id) : null,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
    });
    const rows = result as { id: number }[];
    if (rows?.[0]?.id) onCreated(rows[0].id);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. SEM-5mg" required />
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Semaglutide 5mg" required />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Factory</Label>
              <Select value={form.factory_id} onValueChange={v => set('factory_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>
                  {factories.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Vial Size (mL)</Label>
              <Input type="number" step="0.01" value={form.vial_size_ml} onChange={e => set('vial_size_ml', e.target.value)} placeholder="5" />
            </div>
            <div>
              <Label>Vials per Kit</Label>
              <Input type="number" value={form.vials_per_unit} onChange={e => set('vials_per_unit', e.target.value)} placeholder="1" />
            </div>
            <div>
              <Label>Low Stock Threshold</Label>
              <Input type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>List Price (USD)</Label>
              <Input type="number" step="0.01" value={form.list_price} onChange={e => set('list_price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Standard Cost (USD)</Label>
              <Input type="number" step="0.01" value={form.standard_cost} onChange={e => set('standard_cost', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <Separator />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Fulfillment Channels</p>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.available_warehouse} onCheckedChange={v => set('available_warehouse', v)} id="wh-channel" />
                <Label htmlFor="wh-channel">Warehouse</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.available_china_direct} onCheckedChange={v => set('available_china_direct', v)} id="cn-channel" />
                <Label htmlFor="cn-channel">China Direct</Label>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">Error: {error.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Product'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
