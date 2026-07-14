import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import updateProductAction from '@/actions/products/updateProduct';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit2, Save, X } from 'lucide-react';

const CATEGORIES = ['research peptide', 'cosmetic peptide', 'blend', 'accessory'];

type Product = {
  id: number; sku: string; name: string; description: string; category: string;
  vial_size_ml: number; vials_per_unit: number; list_price: number; currency: string;
  standard_cost: number; available_warehouse: boolean; available_china_direct: boolean;
  factory_id: number; factory_name: string; is_active: boolean; low_stock_threshold: number;
  total_stock: number; total_available: number; batch_count: number; updated_at: string;
};

type Props = { product: Product; factories: { id: number; name: string }[] };

export function ProductDetailsTab({ product, factories }: Props) {
  const { profileId, isAdmin } = useAppUser();
  const [editing, setEditing] = useState(false);
  const factoryLocked = Number(product.batch_count) > 0; // immutable once batches exist (prompt rule)
  const [form, setForm] = useState({
    name: product.name, description: product.description || '',
    category: product.category || '', vial_size_ml: String(product.vial_size_ml),
    vials_per_unit: String(product.vials_per_unit),
    available_warehouse: product.available_warehouse,
    available_china_direct: product.available_china_direct,
    is_active: product.is_active, low_stock_threshold: String(product.low_stock_threshold),
    list_price: String(Number(product.list_price)),
    standard_cost: String(Number(product.standard_cost ?? 0)),
    factory_id: product.factory_id ? String(product.factory_id) : '',
  });
  const [mutate, saving] = useMutateAction(updateProductAction);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    // updateProduct auto-inserts product_price_history rows on price change
    // and ignores factory_id once batches exist.
    await mutate({
      id: product.id,
      ...form,
      vial_size_ml: parseFloat(form.vial_size_ml),
      vials_per_unit: parseInt(form.vials_per_unit),
      list_price: parseFloat(form.list_price) || 0,
      standard_cost: isAdmin ? (parseFloat(form.standard_cost) || 0) : product.standard_cost,
      low_stock_threshold: parseInt(form.low_stock_threshold),
      factory_id: !factoryLocked && form.factory_id ? Number(form.factory_id) : null,
      user_id: profileId,
    });
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Specifications</CardTitle>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3 w-3 mr-1" />{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 className="h-3 w-3 mr-1" />Edit</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => set('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Vial Size (mL)</Label><Input type="number" step="0.01" value={form.vial_size_ml} onChange={e => set('vial_size_ml', e.target.value)} /></div>
                <div><Label>Vials per Kit</Label><Input type="number" value={form.vials_per_unit} onChange={e => set('vials_per_unit', e.target.value)} /></div>
                <div><Label>Low Stock Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>List Price (USD)</Label>
                  <Input type="number" step="0.01" min={0} value={form.list_price} onChange={e => set('list_price', e.target.value)} />
                  <p className="text-xs text-slate-400 mt-0.5">Changes are logged to price history</p>
                </div>
                {isAdmin && (
                  <div>
                    <Label>Standard Cost (USD)</Label>
                    <Input type="number" step="0.01" min={0} value={form.standard_cost} onChange={e => set('standard_cost', e.target.value)} />
                  </div>
                )}
                <div>
                  <Label>Factory {factoryLocked && <span className="text-xs text-slate-400">(locked — batches exist)</span>}</Label>
                  <Select value={form.factory_id} onValueChange={v => set('factory_id', v)} disabled={factoryLocked}>
                    <SelectTrigger><SelectValue placeholder="Select factory…" /></SelectTrigger>
                    <SelectContent>{factories.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Fulfillment Channels</p>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2"><Switch checked={form.available_warehouse} onCheckedChange={v => set('available_warehouse', v)} id="wh" /><Label htmlFor="wh">Warehouse</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.available_china_direct} onCheckedChange={v => set('available_china_direct', v)} id="cn" /><Label htmlFor="cn">China Direct</Label></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} id="active" />
                <Label htmlFor="active">Active</Label>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-slate-500">SKU</span><p className="font-mono font-medium mt-0.5">{product.sku}</p></div>
              <div><span className="text-slate-500">Name</span><p className="font-medium mt-0.5">{product.name}</p></div>
              <div><span className="text-slate-500">Category</span><p className="mt-0.5">{product.category || '—'}</p></div>
              <div><span className="text-slate-500">Factory</span><p className="mt-0.5">{product.factory_name || '—'}</p></div>
              <div><span className="text-slate-500">Vial Size</span><p className="mt-0.5">{product.vial_size_ml} mL</p></div>
              <div><span className="text-slate-500">Vials/Kit</span><p className="mt-0.5">{product.vials_per_unit}</p></div>
              <div><span className="text-slate-500">Low Stock Threshold</span><p className="mt-0.5">{product.low_stock_threshold} kits</p></div>
              <div><span className="text-slate-500">Status</span><p className="mt-0.5"><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge></p></div>
              <div className="col-span-2"><span className="text-slate-500">Channels</span>
                <div className="flex gap-2 mt-0.5">
                  {product.available_warehouse && <Badge variant="outline">Warehouse</Badge>}
                  {product.available_china_direct && <Badge variant="outline">China Direct</Badge>}
                </div>
              </div>
              {product.description && <div className="col-span-2"><span className="text-slate-500">Description</span><p className="mt-0.5">{product.description}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
