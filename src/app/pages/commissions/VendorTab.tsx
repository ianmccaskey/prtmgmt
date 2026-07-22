import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getVendorBalance from '@/actions/commissions/getVendorBalance';
import listVendorPayments from '@/actions/commissions/listVendorPayments';
import recordCommissionPayment from '@/actions/commissions/recordCommissionPayment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Factory } from 'lucide-react';

type VendorBalance = {
  collected_usd: number; rep_commissions_usd: number; warehouse_earned_usd: number;
  vendor_share_usd: number; vendor_paid_usd: number; balance_owed_usd: number;
};
type VendorPayment = { id: number; amount_usd: number; paid_at: string; note: string | null; paid_by: string | null };

const money = (v: number | string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What's owed to the product vendor: everything verified-collected, minus
 * what reps and warehouses earn, minus vendor remittances already recorded.
 */
export function VendorTab() {
  const { profileId, isAdmin } = useAppUser();
  const [balRaw, balLoading, , reloadBal] = useLoadAction(getVendorBalance, [], {});
  const [payRaw, payLoading, , reloadPay] = useLoadAction(listVendorPayments, [], {});
  const [doPay] = useMutateAction(recordCommissionPayment);
  const bal = asRows<VendorBalance>(balRaw)[0];
  const payments = asRows<VendorPayment>(payRaw);

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid payment amount.'); return; }
    setSaving(true); setError('');
    try {
      await doPay({
        payee_type: 'vendor',
        sales_rep_user_profile_id: null,
        warehouse_id: null,
        amount_usd: amt,
        paid_by_user_id: profileId,
        note: note || null,
      });
      setPayOpen(false); setAmount(''); setNote('');
      reloadBal(); reloadPay();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-slate-600" /> Owed to Vendor
          </CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={() => { setPayOpen(true); setAmount(bal ? Math.max(0, Number(bal.balance_owed_usd)).toFixed(2) : ''); setNote(''); setError(''); }}>
              Record Vendor Payment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {balLoading || !bal ? <Skeleton className="h-32 w-full" /> : (
            <div className="max-w-md space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payments collected (verified, net of refunds)</span>
                <span className="tabular-nums">{money(bal.collected_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Sales rep commissions earned</span>
                <span className="tabular-nums text-red-600">−{money(bal.rep_commissions_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Warehouse shipping earned</span>
                <span className="tabular-nums text-red-600">−{money(bal.warehouse_earned_usd)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <span>Vendor share</span>
                <span className="tabular-nums">{money(bal.vendor_share_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Vendor payments made</span>
                <span className="tabular-nums text-red-600">−{money(bal.vendor_paid_usd)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                <span>Balance owed to vendor</span>
                <span className={`tabular-nums ${Number(bal.balance_owed_usd) > 0 ? 'text-green-700' : ''}`}>{money(bal.balance_owed_usd)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Rep commissions accrue on confirmed+ orders (10%); warehouse earnings accrue per shipped
                shipment at the rate plan. Both are counted when earned, not when paid out.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendor Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payLoading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(p.amount_usd)}</TableCell>
                    <TableCell>{p.paid_by || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.note || '—'}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">No vendor payments recorded yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={v => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Vendor Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Current balance owed: <span className="font-medium text-gray-900">{bal ? money(bal.balance_owed_usd) : '—'}</span>
            </p>
            <div>
              <Label>Payment Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. USDT sent to vendor wallet, tx …" rows={2} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
