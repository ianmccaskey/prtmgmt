import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Calculator, Star } from 'lucide-react';
import listRatePlans from '@/actions/settings/listRatePlans';
import createRatePlan from '@/actions/settings/createRatePlan';
import { calcShippingCost } from '@/lib/shippingCost';

type RatePlan = {
  id: number; effective_date: string; base_kits: number; base_price_usd: number;
  tier_kits: number; tier_price_usd: number; notes: string; created_at: string; created_by_name: string;
};

export function RatePlansTab() {
  const { profileId } = useAppUser();
  const [showAdd, setShowAdd] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [baseKits, setBaseKits] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [tierKits, setTierKits] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [calcKits, setCalcKits] = useState('');

  const [plans, , , reload] = useLoadAction(listRatePlans, [], {});
  const [doCreate] = useMutateAction(createRatePlan);

  const planList = (plans as RatePlan[]) || [];
  const today = new Date().toISOString().split('T')[0];

  // Active plan = most recent with effective_date <= today
  const activePlan = planList.find(p => p.effective_date.split('T')[0] <= today);

  const calcResult = activePlan && calcKits ? calcShippingCost(activePlan, Number(calcKits)) : null;

  const handleAdd = async () => {
    if (!effectiveDate || !baseKits || !basePrice || !tierKits || !tierPrice) {
      setError('All rate fields and effective date are required.');
      return;
    }
    if (effectiveDate < today) {
      setError('Effective date must be today or in the future.');
      return;
    }
    setSaving(true); setError('');
    try {
      await doCreate({
        effective_date: effectiveDate, base_kits: Number(baseKits),
        base_price_usd: Number(basePrice), tier_kits: Number(tierKits),
        tier_price_usd: Number(tierPrice), notes: planNotes || null, user_id: profileId,
      });
      setShowAdd(false);
      setEffectiveDate(''); setBaseKits(''); setBasePrice(''); setTierKits(''); setTierPrice(''); setPlanNotes('');
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create rate plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Warehouse Shipping Rate Plans</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective Date</TableHead>
                <TableHead className="text-right">Base Kits</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead className="text-right">+Tier Kits</TableHead>
                <TableHead className="text-right">Tier Price</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planList.map(p => {
                const isActive = p === activePlan;
                return (
                  <TableRow key={p.id} className={isActive ? 'bg-green-50' : ''}>
                    <TableCell className="font-medium text-sm">{p.effective_date?.split('T')[0]}</TableCell>
                    <TableCell className="text-right text-sm">{p.base_kits}</TableCell>
                    <TableCell className="text-right text-sm">${p.base_price_usd}</TableCell>
                    <TableCell className="text-right text-sm">{p.tier_kits}</TableCell>
                    <TableCell className="text-right text-sm">${p.tier_price_usd}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.created_by_name || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[140px] truncate">{p.notes || '—'}</TableCell>
                    <TableCell className="text-center">
                      {isActive
                        ? <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit mx-auto"><Star className="h-3 w-3" /> Active</Badge>
                        : <Badge variant="outline" className="text-xs">{p.effective_date?.split('T')[0] > today ? 'Future' : 'Superseded'}</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {planList.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-400">No rate plans</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Calculator */}
      {activePlan && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Cost Calculator (Active Plan)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Kit count:</Label>
                <Input type="number" min={1} value={calcKits} onChange={e => setCalcKits(e.target.value)} className="w-24" placeholder="e.g. 50" />
              </div>
              {calcResult !== null && (
                <div className="text-sm">
                  → Estimated cost: <span className="font-bold text-green-700">${calcResult.toFixed(2)}</span>
                  <span className="text-gray-400 ml-2 text-xs">
                    (base ${activePlan.base_price_usd} for ≤{activePlan.base_kits} kits, +${activePlan.tier_price_usd} per {activePlan.tier_kits} extra)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Plan Dialog */}
      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Rate Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Effective Date * (today or future)</Label>
              <Input type="date" min={today} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Base Kits *</Label><Input type="number" min={1} value={baseKits} onChange={e => setBaseKits(e.target.value)} placeholder="e.g. 20" /></div>
              <div><Label>Base Price USD *</Label><Input type="number" min={0} step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="e.g. 50.00" /></div>
              <div><Label>+Tier Kits *</Label><Input type="number" min={1} value={tierKits} onChange={e => setTierKits(e.target.value)} placeholder="e.g. 10" /></div>
              <div><Label>Tier Price USD *</Label><Input type="number" min={0} step="0.01" value={tierPrice} onChange={e => setTierPrice(e.target.value)} placeholder="e.g. 15.00" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2} /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Create Plan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
