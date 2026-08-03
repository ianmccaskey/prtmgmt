import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import listInventoryAction from '@/actions/warehouse/listInventory';
import listProductsAction from '@/actions/products/listProducts';
import listBatchesAction from '@/actions/batches/listBatches';
import listProductCategories from '@/actions/settings/listProductCategories';
import createStockHold from '@/actions/warehouse/createStockHold';
import releaseStockHold from '@/actions/warehouse/releaseStockHold';
import listStockHolds from '@/actions/warehouse/listStockHolds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Hand } from 'lucide-react';

type StockHold = {
  id: number; quantity: number; hold_reason: string | null; created_at: string;
  created_by: string | null; product_name: string; sku: string; batch_number: string; warehouse_name: string;
};

type InventoryRow = {
  id: number; sku: string; product_name: string; category: string; list_price: number; low_stock_threshold: number;
  batch_number: string; qc_status: string; manufacture_date: string;
  warehouse_name: string; quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
  in_transit_inbound: number; next_arrival_date: string; product_total_available: number;
};

const QC_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  quarantine: 'bg-orange-100 text-orange-700',
};

type Props = { warehouseId: string; warehouseList: { id: number; name: string }[] };

export function InventoryTab({ warehouseId, warehouseList }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [qcStatus, setQcStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [batchId, setBatchId] = useState('');

  const [inventory, loading, , reloadInv] = useLoadAction(listInventoryAction, [warehouseId, search, category, qcStatus, productId, batchId], {
    warehouse_id: warehouseId, search, category, qc_status: qcStatus, product_id: productId, batch_id: batchId,
  });
  const rows: InventoryRow[] = asRows(inventory);

  // Manual stock holds: reserve without a sales order. Availability math
  // everywhere already subtracts reserved, so a hold protects stock from
  // order reservation and allocation automatically.
  const { profileId } = useAppUser();
  const [holdsRaw, , , reloadHolds] = useLoadAction(listStockHolds, [warehouseId], { warehouse_id: warehouseId });
  const holds = asRows<StockHold>(holdsRaw);
  const [doHold] = useMutateAction(createStockHold);
  const [doReleaseHold] = useMutateAction(releaseStockHold);
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [holdRow, setHoldRow] = useState<InventoryRow | null>(null);
  const [holdQty, setHoldQty] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdSaving, setHoldSaving] = useState(false);
  const [holdErr, setHoldErr] = useState('');

  const openHold = (r: InventoryRow) => { setHoldRow(r); setHoldQty(''); setHoldReason(''); setHoldErr(''); };
  const placeHold = async () => {
    if (!holdRow) return;
    const qty = Number(holdQty);
    if (!Number.isInteger(qty) || qty <= 0) { setHoldErr('Enter a whole quantity greater than zero.'); return; }
    if (!holdReason.trim()) { setHoldErr('A reason is required — it shows wherever this hold blocks stock.'); return; }
    setHoldSaving(true); setHoldErr('');
    try {
      const res = await doHold({ inventory_id: holdRow.id, quantity: qty, reason: holdReason.trim(), userId: profileId }) as unknown[];
      if (!res || res.length === 0) {
        setHoldErr('Not enough available stock — someone may have just reserved it. Refresh and try again.');
        return;
      }
      setHoldRow(null);
      reloadInv(); reloadHolds();
    } catch (e: unknown) {
      setHoldErr(e instanceof Error ? e.message : 'Failed to place hold');
    } finally {
      setHoldSaving(false);
    }
  };
  const releaseHold = async (id: number) => {
    await doReleaseHold({ hold_id: id });
    reloadInv(); reloadHolds();
  };

  const [products] = useLoadAction(listProductsAction, [], {});
  const productList = asRows<{ id: number; name: string; sku: string }>(products);
  const [batches] = useLoadAction(listBatchesAction, [productId], { product_id: productId || null });
  const batchList = asRows<{ id: number; batch_number: string }>(batches);
  const [catsRaw] = useLoadAction(listProductCategories, [], {});
  const categoryNames = asRows<{ name: string }>(catsRaw).map(c => c.name);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap gap-3 items-center">
          <CardTitle className="text-base">Inventory</CardTitle>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search product, SKU, batch…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8" />
          </div>
          <Select value={productId} onValueChange={v => { setProductId(v); setBatchId(''); }}>
            <SelectTrigger className="w-44 h-8"><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All products</SelectItem>
              {productList.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={batchId} onValueChange={setBatchId} disabled={!productId}>
            <SelectTrigger className="w-36 h-8"><SelectValue placeholder="All batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All batches</SelectItem>
              {batchList.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.batch_number}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 h-8"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categoryNames.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={qcStatus} onValueChange={setQcStatus}>
            <SelectTrigger className="w-36 h-8"><SelectValue placeholder="All QC" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All QC</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="quarantine">Quarantined</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setHoldsOpen(true)}>
            <Hand className="h-3.5 w-3.5 mr-1" /> Holds{holds.length > 0 ? ` (${holds.length})` : ''}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (<>
          {/* Mobile: stacked cards */}
          <div className="sm:hidden divide-y">
            {rows.map(r => {
              const isLowStock = Number(r.product_total_available) <= Number(r.low_stock_threshold);
              return (
                <div key={r.id} className={`p-3 space-y-2 ${isLowStock ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{r.product_name}</div>
                      <div className="text-xs text-slate-400">{r.sku} · <span className="font-mono">{r.batch_number}</span></div>
                    </div>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${QC_COLORS[r.qc_status] || 'bg-slate-100 text-slate-600'}`}>{r.qc_status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {r.warehouse_name}
                    {isLowStock && <Badge className="text-xs bg-red-100 text-red-700">Low Stock</Badge>}
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="rounded bg-slate-50 py-1">
                      <div className="text-sm font-medium text-slate-700">{r.quantity_on_hand}</div>
                      <div className="text-[10px] text-slate-400">On Hand</div>
                    </div>
                    <div className="rounded bg-slate-50 py-1">
                      <div className="text-sm font-medium text-orange-600">{r.quantity_reserved}</div>
                      <div className="text-[10px] text-slate-400">Reserved</div>
                    </div>
                    <div className="rounded bg-slate-50 py-1">
                      <div className={`text-sm font-medium ${r.quantity_available === 0 ? 'text-slate-400' : 'text-green-600'}`}>{r.quantity_available}</div>
                      <div className="text-[10px] text-slate-400">Available</div>
                    </div>
                    <div className="rounded bg-slate-50 py-1">
                      <div className="text-sm font-medium text-purple-600">{r.in_transit_inbound > 0 ? r.in_transit_inbound : '—'}</div>
                      <div className="text-[10px] text-slate-400">In-Transit</div>
                    </div>
                  </div>
                  {r.next_arrival_date && (
                    <div className="text-xs text-slate-400">Next arrival {new Date(r.next_arrival_date).toLocaleDateString()}</div>
                  )}
                  {r.quantity_available > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openHold(r)}>
                      <Hand className="h-3 w-3 mr-1" /> Hold Stock
                    </Button>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No inventory records</div>}
          </div>
          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Product</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Batch</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Warehouse</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">QC</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">On Hand</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Reserved</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Available</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">In-Transit</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Next Arrival</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isLowStock = Number(r.product_total_available) <= Number(r.low_stock_threshold);
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 ${isLowStock ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{r.product_name}</div>
                        <div className="text-xs text-slate-400">{r.sku}</div>
                        {isLowStock && <Badge className="text-xs bg-red-100 text-red-700 mt-0.5">Low Stock</Badge>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.batch_number}</td>
                      <td className="px-3 py-2 text-slate-600">{r.warehouse_name}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${QC_COLORS[r.qc_status] || 'bg-slate-100 text-slate-600'}`}>{r.qc_status}</span></td>
                      <td className="px-3 py-2 text-right">{r.quantity_on_hand}</td>
                      <td className="px-3 py-2 text-right text-orange-600">{r.quantity_reserved}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.quantity_available === 0 ? 'text-slate-400' : 'text-green-600'}`}>{r.quantity_available}</td>
                      <td className="px-3 py-2 text-right text-purple-600">{r.in_transit_inbound > 0 ? r.in_transit_inbound : '—'}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{r.next_arrival_date ? new Date(r.next_arrival_date).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {r.quantity_available > 0 && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" title="Reserve stock without an order" onClick={() => openHold(r)}>
                            <Hand className="h-3 w-3 mr-1" /> Hold
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-slate-400">No inventory records</td></tr>}
              </tbody>
            </table>
          </div>
        </>)}
      </CardContent>

      {/* Place a hold */}
      <Dialog open={holdRow != null} onOpenChange={v => !v && setHoldRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Hold Stock</DialogTitle></DialogHeader>
          {holdRow && (
            <div className="space-y-3 py-2">
              <p className="text-sm">
                <span className="font-medium">{holdRow.product_name}</span>
                <span className="text-muted-foreground"> · batch </span><span className="font-mono text-xs">{holdRow.batch_number}</span>
                <span className="text-muted-foreground"> · {holdRow.warehouse_name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Reserves stock with no sales order — held units can&apos;t be reserved or shipped by orders until
                released. {holdRow.quantity_available} available on this row.
              </p>
              <div>
                <Label className="text-xs">Quantity *</Label>
                <Input type="number" min={1} max={holdRow.quantity_available} step={1} value={holdQty}
                  onChange={e => setHoldQty(e.target.value)} className="h-8 w-28" />
              </div>
              <div>
                <Label className="text-xs">Reason *</Label>
                <Textarea rows={2} value={holdReason} onChange={e => setHoldReason(e.target.value)}
                  placeholder="e.g. set aside for trade-show samples" />
              </div>
              {holdErr && <p className="text-xs text-red-600">{holdErr}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldRow(null)} disabled={holdSaving}>Cancel</Button>
            <Button onClick={placeHold} disabled={holdSaving}>{holdSaving ? 'Holding…' : 'Hold Stock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active holds */}
      <Dialog open={holdsOpen} onOpenChange={setHoldsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Active Stock Holds</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            {holds.map(h => (
              <div key={h.id} className="flex items-start justify-between gap-2 border rounded-md p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{h.product_name} <span className="text-muted-foreground font-normal">× {h.quantity}</span></p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{h.batch_number}</span> · {h.warehouse_name}
                  </p>
                  <p className="text-xs mt-0.5">{h.hold_reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.created_by || 'unknown'} · {new Date(h.created_at).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => releaseHold(h.id)}>
                  Release
                </Button>
              </div>
            ))}
            {holds.length === 0 && <p className="text-sm text-muted-foreground">No active holds{warehouseId ? ' for this warehouse' : ''}.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
