import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import listProductsAction from '@/actions/products/listProducts';
import listFactoriesAction from '@/actions/products/listFactories';
import createProductAction from '@/actions/products/createProduct';
import bulkUpdateListPriceAction from '@/actions/products/bulkUpdateListPrice';
import { useAppUser } from '@/app/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutGrid, LayoutList, Plus, Search, Package } from 'lucide-react';
import { usePagination, PaginationFooter } from '@/components/Paginated';
import { NewProductDialog } from '@/app/pages/products/NewProductDialog';

type Product = {
  id: number; sku: string; name: string; category: string;
  vial_size_ml: number; vials_per_unit: number; list_price: number;
  currency: string; standard_cost: number; available_warehouse: boolean;
  available_china_direct: boolean; factory_id: number; is_active: boolean;
  low_stock_threshold: number; factory_name: string; total_stock: number; total_available: number;
};

const CATEGORIES = ['research peptide', 'cosmetic peptide', 'blend', 'accessory'];

export function ProductsPage() {
  const navigate = useNavigate();
  const { profileId, isAdmin } = useAppUser();
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [channel, setChannel] = useState('');
  const [isActive, setIsActive] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDelta, setBulkDelta] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [doBulkPrice] = useMutateAction(bulkUpdateListPriceAction);

  const [products, loading, , reload] = useLoadAction(listProductsAction, [], { search, category, factory_id: factoryId, channel, is_active: isActive });
  const [factories] = useLoadAction(listFactoriesAction, [], {});
  const rows: Product[] = Array.isArray(products) ? products : [];
  const factoryList: { id: number; name: string }[] = Array.isArray(factories) ? factories : [];
  const pgProd = usePagination(rows);

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const applyBulkPrice = async () => {
    const delta = parseFloat(bulkDelta);
    if (!delta || selected.size === 0) return;
    setBulkSaving(true);
    await doBulkPrice({ ids: `{${Array.from(selected).join(',')}}`, delta, user_id: profileId });
    setBulkSaving(false);
    setSelected(new Set());
    setBulkDelta('');
    reload();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500">{rows.length} peptide products</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Product</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search SKU or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={factoryId} onValueChange={setFactoryId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All factories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All factories</SelectItem>
                {factoryList.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All channels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All channels</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="china_direct">China Direct</SelectItem>
              </SelectContent>
            </Select>
            <Select value={isActive} onValueChange={setIsActive}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Active status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('table')}><LayoutList className="h-4 w-4" /></Button>
              <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk price toolbar (flat $ change only — prompt rule) */}
      {isAdmin && selected.size > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Label className="text-xs">Flat $ change to list price</Label>
            <Input type="number" step="0.01" placeholder="+5.00 or -2.50" value={bulkDelta} onChange={e => setBulkDelta(e.target.value)} className="w-36 h-8" />
            <Button size="sm" onClick={applyBulkPrice} disabled={bulkSaving || !parseFloat(bulkDelta)}>
              {bulkSaving ? 'Applying…' : 'Apply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : view === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-3 w-8">
                        <input type="checkbox"
                          checked={rows.length > 0 && selected.size === rows.length}
                          onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />
                      </th>
                    )}
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Vial/Kit</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">List Price</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total Stock</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Channels</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Factory</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <tr key={p.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                      {isAdmin && (
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.vial_size_ml}mL × {p.vials_per_unit}</td>
                      <td className="px-4 py-3 text-right font-medium">${Number(p.list_price).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${Number(p.total_available) <= Number(p.low_stock_threshold) ? 'text-red-600' : 'text-slate-700'}`}>
                        {p.total_available} <span className="text-xs text-slate-400">/{p.total_stock}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {p.available_warehouse && <Badge variant="outline" className="text-xs">WH</Badge>}
                          {p.available_china_direct && <Badge variant="outline" className="text-xs">CN</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.factory_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-400">No products found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationFooter {...pgProd} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map(p => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/products/${p.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-500" />
                  </div>
                  <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">{p.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="font-semibold text-slate-800 text-sm leading-tight mb-0.5">{p.name}</div>
                <div className="text-xs text-slate-400 mb-2">{p.sku}</div>
                <div className="text-xs text-slate-500 mb-3">{p.category} · {p.vial_size_ml}mL × {p.vials_per_unit}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-800">${Number(p.list_price).toFixed(2)}</span>
                  <span className={`text-xs font-medium ${Number(p.total_available) <= Number(p.low_stock_threshold) ? 'text-red-600' : 'text-slate-500'}`}>
                    {p.total_available} avail
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {p.available_warehouse && <Badge variant="outline" className="text-xs">WH</Badge>}
                  {p.available_china_direct && <Badge variant="outline" className="text-xs">CN</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400">No products found</div>
          )}
        </div>
      )}

      <NewProductDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        factories={factoryList}
        onCreated={(id) => { setShowNew(false); navigate(`/products/${id}`); }}
      />
    </div>
  );
}
