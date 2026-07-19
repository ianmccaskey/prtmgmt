import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import getProductPriceTiersAction from '@/actions/products/getProductPriceTiers';
import addPriceTierAction from '@/actions/products/addPriceTier';
import updatePriceTierAction from '@/actions/products/updatePriceTier';
import deletePriceTierAction from '@/actions/products/deletePriceTier';
import getProductPriceHistoryAction from '@/actions/products/getProductPriceHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppUser } from '@/app/AppContext';

type PriceTier = { id: number; product_id: number; min_quantity: number; unit_price: number };
type PriceHistory = { id: number; field: string; old_value: number; new_value: number; changed_at: string; changed_by_name: string };

type Props = { productId: number; listPrice: number; standardCost: number };

export function ProductPricingTab({ productId, listPrice, standardCost }: Props) {
  // Cost data + price history (an audit surface) are admin-only; sales reps see
  // list price and tiers read-only per the access matrix.
  const { isAdmin, isLogistics } = useAppUser();
  const seesCosts = isAdmin || isLogistics;
  const [tiers, tiersLoading, , reloadTiers] = useLoadAction(getProductPriceTiersAction, [], { product_id: productId });
  const [history, histLoading] = useLoadAction(getProductPriceHistoryAction, [], { product_id: productId }, { enabled: seesCosts });
  const [addTier] = useMutateAction(addPriceTierAction);
  const [updateTier] = useMutateAction(updatePriceTierAction);
  const [deleteTier] = useMutateAction(deletePriceTierAction);

  const tierRows: PriceTier[] = asRows(tiers);
  const histRows: PriceHistory[] = asRows(history);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ min_quantity: '', unit_price: '' });
  const [newForm, setNewForm] = useState({ min_quantity: '', unit_price: '' });
  const [showNew, setShowNew] = useState(false);

  const handleSaveTier = async (tier: PriceTier) => {
    await updateTier({ id: tier.id, min_quantity: parseInt(editForm.min_quantity), unit_price: parseFloat(editForm.unit_price) });
    setEditId(null);
    await reloadTiers();
  };

  const handleAddTier = async () => {
    if (!newForm.min_quantity || !newForm.unit_price) return;
    await addTier({ product_id: productId, min_quantity: parseInt(newForm.min_quantity), unit_price: parseFloat(newForm.unit_price) });
    setShowNew(false);
    setNewForm({ min_quantity: '', unit_price: '' });
    await reloadTiers();
  };

  const handleDeleteTier = async (id: number) => {
    await deleteTier({ id });
    await reloadTiers();
  };

  // Build chart data from history
  const chartData = (() => {
    const sorted = [...histRows].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    const result: { date: string; list_price?: number; standard_cost?: number }[] = [];
    let lp = Number(listPrice), sc = Number(standardCost);
    for (const h of sorted) {
      if (h.field === 'list_price') { lp = Number(h.new_value); }
      if (h.field === 'standard_cost') { sc = Number(h.new_value); }
      const date = new Date(h.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ date, list_price: lp, standard_cost: sc });
    }
    return result;
  })();

  return (
    <div className="space-y-4">
      {/* Price Tiers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Price Tiers</CardTitle>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setShowNew(true)}><Plus className="h-3 w-3 mr-1" />Add Tier</Button>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tiersLoading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Min Quantity</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Unit Price</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Discount</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {showNew && (
                  <tr className="border-b bg-blue-50">
                    <td className="px-4 py-2"><Input type="number" placeholder="Min qty" value={newForm.min_quantity} onChange={e => setNewForm(f => ({ ...f, min_quantity: e.target.value }))} className="h-7 w-28" /></td>
                    <td className="px-4 py-2 text-right"><Input type="number" step="0.01" placeholder="Price" value={newForm.unit_price} onChange={e => setNewForm(f => ({ ...f, unit_price: e.target.value }))} className="h-7 w-28 ml-auto" /></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="h-7" onClick={handleAddTier}><Save className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowNew(false)}><X className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                )}
                {tierRows.map(t => {
                  const discount = listPrice > 0 ? ((listPrice - Number(t.unit_price)) / listPrice * 100) : 0;
                  return (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      {editId === t.id ? (
                        <>
                          <td className="px-4 py-2"><Input type="number" value={editForm.min_quantity} onChange={e => setEditForm(f => ({ ...f, min_quantity: e.target.value }))} className="h-7 w-28" /></td>
                          <td className="px-4 py-2 text-right"><Input type="number" step="0.01" value={editForm.unit_price} onChange={e => setEditForm(f => ({ ...f, unit_price: e.target.value }))} className="h-7 w-28 ml-auto" /></td>
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" className="h-7" onClick={() => handleSaveTier(t)}><Save className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-medium">{t.min_quantity}+ kits</td>
                          <td className="px-4 py-2 text-right font-medium">${Number(t.unit_price).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right"><Badge variant="outline" className="text-xs">{discount.toFixed(0)}% off</Badge></td>
                          <td className="px-4 py-2">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(t.id); setEditForm({ min_quantity: String(t.min_quantity), unit_price: String(t.unit_price) }); }}><Edit2 className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteTier(t.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {tierRows.length === 0 && !showNew && (
                  <tr><td colSpan={4} className="text-center py-4 text-slate-400 text-sm">No price tiers. Base price: ${Number(listPrice).toFixed(2)}</td></tr>
                )}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>

      {/* Price History Chart (admin only — exposes cost data) */}
      {seesCosts && chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Price History</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="list_price" name="List Price" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="standard_cost" name="Standard Cost" stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Price Change Log (cost audit surface — admin + logistics view) */}
      {seesCosts && (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Price Change Log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {histLoading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Field</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Old</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">New</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Changed By</th>
                </tr>
              </thead>
              <tbody>
                {histRows.map(h => (
                  <tr key={h.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{new Date(h.changed_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{h.field}</Badge></td>
                    <td className="px-4 py-2 text-right text-red-500">${Number(h.old_value).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-green-600">${Number(h.new_value).toFixed(2)}</td>
                    <td className="px-4 py-2 text-slate-600">{h.changed_by_name || '—'}</td>
                  </tr>
                ))}
                {histRows.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No price history yet</td></tr>}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
