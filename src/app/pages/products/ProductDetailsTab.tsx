import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { rows } from '@/lib/rows';
import { useAppUser } from '@/app/AppContext';
import updateProductAction from '@/actions/products/updateProduct';
import listProductCategories from '@/actions/settings/listProductCategories';
import { FileUpload } from '@/components/FileUpload';
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

type Product = {
  id: number; sku: string; name: string; description: string; category: string;
  vial_size_ml: number; vials_per_unit: number; list_price: number; currency: string;
  standard_cost: number; available_warehouse: boolean; available_china_direct: boolean;
  factory_id: number; factory_name: string; is_active: boolean; low_stock_threshold: number;
  total_stock: number; total_available: number; batch_count: number; updated_at: string;
  image_file?: string | null;
  show_on_pricelist?: boolean; promo_badge?: boolean; pricelist_status_override?: string;
  pricelist_group?: string | null; pricelist_spec?: string | null; pricelist_note?: string | null;
  pricelist_sort?: number;
};

// Default sheet group when none is set: product name minus a trailing
// dosage token, uppercased ("Tirzepatide 60" → "TIRZEPATIDE"). The sync
// tool applies the identical rule — keep them in lockstep.
const derivedGroup = (name: string) => name.replace(/\s+\d+[a-z+]*$/i, '').toUpperCase();

const PRICELIST_STATUS_OPTIONS = [
  { value: 'auto', label: 'Auto (from stock & inbound)' },
  { value: 'available', label: 'Available' },
  { value: 'in_production', label: 'In production' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const;

type Props = { product: Product; factories: { id: number; name: string }[] };

export function ProductDetailsTab({ product, factories }: Props) {
  const { profileId, isAdmin, isLogistics } = useAppUser();
  const [editing, setEditing] = useState(false);
  const [catsRaw] = useLoadAction(listProductCategories, [], {});
  // Active categories, plus the product's current one even if deactivated.
  const categories = rows<{ name: string; is_active: boolean }>(catsRaw)
    .filter(c => c.is_active || c.name === product.category)
    .map(c => c.name);
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
    image_file: '',
    show_on_pricelist: Boolean(product.show_on_pricelist),
    promo_badge: Boolean(product.promo_badge),
    pricelist_status_override: product.pricelist_status_override || 'auto',
    pricelist_group: product.pricelist_group || '',
    pricelist_spec: product.pricelist_spec || '',
    pricelist_note: product.pricelist_note || '',
    pricelist_sort: String(product.pricelist_sort ?? 999),
  });
  const [mutate, saving] = useMutateAction(updateProductAction);
  const [saveError, setSaveError] = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaveError('');
    try {
    // updateProduct auto-inserts product_price_history rows on price change
    // and ignores factory_id once batches exist.
    await mutate({
      id: product.id,
      ...form,
      vial_size_ml: parseFloat(form.vial_size_ml),
      vials_per_unit: parseInt(form.vials_per_unit),
      list_price: parseFloat(form.list_price) || 0,
      // Non-admins pass null — the action's COALESCE leaves the live cost
      // untouched (a stale prop must never clobber an admin's cost change).
      standard_cost: isAdmin ? (parseFloat(form.standard_cost) || 0) : null,
      low_stock_threshold: parseInt(form.low_stock_threshold),
      pricelist_sort: parseInt(form.pricelist_sort) || 999,
      factory_id: !factoryLocked && form.factory_id ? Number(form.factory_id) : null,
      image_file: form.image_file || null,
      user_id: profileId,
    });
    setEditing(false);
    } catch (e: unknown) {
      // e.g. the category was renamed in Settings while this form was open
      // (FK rejects) — keep editing open so nothing is silently lost.
      setSaveError(e instanceof Error ? e.message : 'Failed to save product');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          {saveError && editing && <p className="text-sm text-red-600 bg-red-50 rounded p-2 mb-2">{saveError}</p>}
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Specifications</CardTitle>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3 w-3 mr-1" />{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            ) : !isLogistics ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 className="h-3 w-3 mr-1" />Edit</Button>
            ) : null}
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
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><Label>Vial Size (mL)</Label><Input type="number" step="0.01" value={form.vial_size_ml} onChange={e => set('vial_size_ml', e.target.value)} /></div>
                <div><Label>Vials per Kit</Label><Input type="number" value={form.vials_per_unit} onChange={e => set('vials_per_unit', e.target.value)} /></div>
                <div><Label>Low Stock Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <Label>Product Image</Label>
                <div className="flex items-center gap-3 mt-1">
                  {(form.image_file || product.image_file) && (
                    <img src={form.image_file || product.image_file || ''} className="w-14 h-14 rounded object-cover border" alt={product.name} />
                  )}
                  <FileUpload accept="image/*" label={product.image_file || form.image_file ? 'Replace image' : 'Upload image'} onUploaded={url => set('image_file', url)} />
                  {(form.image_file || product.image_file) && form.image_file !== '__CLEAR__' && (
                    <Button type="button" size="sm" variant="ghost" className="text-red-500 h-7 text-xs" onClick={() => set('image_file', '__CLEAR__')}>Remove</Button>
                  )}
                  {form.image_file === '__CLEAR__' && <span className="text-xs text-red-500">Image will be removed on save</span>}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Public Price List</p>
                <div className="flex gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.show_on_pricelist} onCheckedChange={v => set('show_on_pricelist', v)} id="pl-show" />
                    <Label htmlFor="pl-show">Show on price list</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.promo_badge} onCheckedChange={v => set('promo_badge', v)} id="pl-promo" />
                    <Label htmlFor="pl-promo">Promo badge</Label>
                  </div>
                </div>
                {form.show_on_pricelist && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Price List Status</Label>
                        <Select value={form.pricelist_status_override} onValueChange={v => set('pricelist_status_override', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRICELIST_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-400 mt-0.5">Auto = Available when sellable stock exists, In transit when inbound, else Out of stock</p>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input type="number" value={form.pricelist_sort} onChange={e => set('pricelist_sort', e.target.value)} />
                        <p className="text-xs text-slate-400 mt-0.5">Orders the groups (lower first); variants inside a group order by mass automatically</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Group Name</Label>
                        <Input value={form.pricelist_group} onChange={e => set('pricelist_group', e.target.value)}
                          placeholder={derivedGroup(form.name || product.name)} />
                        <p className="text-xs text-slate-400 mt-0.5">Variants sharing a group render under one heading</p>
                      </div>
                      <div>
                        <Label>Variant / Content</Label>
                        <Input value={form.pricelist_spec} onChange={e => set('pricelist_spec', e.target.value)}
                          placeholder={`e.g. 30mg × ${form.vials_per_unit || product.vials_per_unit} vials`} />
                      </div>
                    </div>
                    <div>
                      <Label>Sub-description (optional)</Label>
                      <Input value={form.pricelist_note} onChange={e => set('pricelist_note', e.target.value)}
                        placeholder="e.g. blend composition shown under the group name" />
                    </div>
                  </>
                )}
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
              <div><span className="text-slate-500">Status</span><div className="mt-0.5"><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge></div></div>
              <div className="col-span-2"><span className="text-slate-500">Channels</span>
                <div className="flex gap-2 mt-0.5">
                  {product.available_warehouse && <Badge variant="outline">Warehouse</Badge>}
                  {product.available_china_direct && <Badge variant="outline">China Direct</Badge>}
                </div>
              </div>
              <div className="col-span-2"><span className="text-slate-500">Public Price List</span>
                <div className="flex gap-2 mt-0.5 items-center flex-wrap">
                  {product.show_on_pricelist ? (
                    <>
                      <Badge variant="outline" className="text-green-700 border-green-300">Listed</Badge>
                      {product.promo_badge && <Badge variant="outline" className="text-amber-700 border-amber-300">Promo badge</Badge>}
                      {(product.pricelist_status_override || 'auto') !== 'auto' && (
                        <Badge variant="outline">{PRICELIST_STATUS_OPTIONS.find(o => o.value === product.pricelist_status_override)?.label ?? product.pricelist_status_override}</Badge>
                      )}
                      <span className="text-xs text-slate-500">
                        {(product.pricelist_group || derivedGroup(product.name))}{product.pricelist_spec ? ` — ${product.pricelist_spec}` : ''}
                      </span>
                    </>
                  ) : <Badge variant="secondary">Not listed</Badge>}
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
