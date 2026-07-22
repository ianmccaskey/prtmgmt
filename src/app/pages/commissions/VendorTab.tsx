import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getVendorBalance from '@/actions/commissions/getVendorBalance';
import listVendorPayments from '@/actions/commissions/listVendorPayments';
import recordCommissionPayment from '@/actions/commissions/recordCommissionPayment';
import listRepBalances from '@/actions/commissions/listRepBalances';
import listWarehouseBalances from '@/actions/commissions/listWarehouseBalances';
import executeSettlementAtomic from '@/actions/commissions/executeSettlementAtomic';
import listSettlements from '@/actions/commissions/listSettlements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Factory, Stamp } from 'lucide-react';

type VendorBalance = {
  last_settlement_id: number | null; last_settled_at: string | null;
  collected_usd: number; rep_commissions_usd: number; warehouse_earned_usd: number;
  vendor_share_usd: number; vendor_paid_usd: number; balance_owed_usd: number;
  carried_adjustment_usd: number;
};
type VendorPayment = { id: number; amount_usd: number; paid_at: string; note: string | null; paid_by: string | null };
type Settlement = {
  id: number; settled_at: string; collected_usd: number; rep_commissions_usd: number;
  warehouse_earned_usd: number; vendor_share_usd: number; note: string | null; created_by: string | null;
};

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

  // Settle All: stamp + zero every ledger in one atomic statement.
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleErr, setSettleErr] = useState('');
  const [doSettle] = useMutateAction(executeSettlementAtomic);
  const [settlementsRaw, , , reloadSettlements] = useLoadAction(listSettlements, [], {});
  const settlements = asRows<Settlement>(settlementsRaw);
  // Preview: what the stamp will contain (same source actions as the tabs).
  const [repBalRaw] = useLoadAction(listRepBalances, [settleOpen ? 1 : 0], {}, { enabled: settleOpen });
  const [whBalRaw] = useLoadAction(listWarehouseBalances, [settleOpen ? 1 : 0], { warehouse_id: '' }, { enabled: settleOpen });
  const repOwedTotal = asRows<{ balance_owed_usd: number }>(repBalRaw).reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);
  const whOwedTotal = asRows<{ balance_owed_usd: number }>(whBalRaw).reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);

  const handleSettle = async () => {
    setSettling(true); setSettleErr('');
    try {
      await doSettle({ note: settleNote || null, user_id: profileId });
      setSettleOpen(false); setSettleNote('');
      reloadBal(); reloadPay(); reloadSettlements();
    } catch (e: unknown) {
      setSettleErr(e instanceof Error ? e.message : 'Settlement failed');
    } finally {
      setSettling(false);
    }
  };

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
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setPayOpen(true); setAmount(bal ? Math.max(0, Number(bal.balance_owed_usd)).toFixed(2) : ''); setNote(''); setError(''); }}>
                Record Vendor Payment
              </Button>
              <Button size="sm" onClick={() => { setSettleOpen(true); setSettleNote(''); setSettleErr(''); }}>
                <Stamp className="h-3.5 w-3.5 mr-1" /> Settle All Now
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {balLoading || !bal ? <Skeleton className="h-32 w-full" /> : (
            <div className="max-w-md space-y-1.5 text-sm">
              <p className="text-xs text-muted-foreground">
                {bal.last_settled_at
                  ? <>Current cycle — since settlement #{bal.last_settlement_id} on {new Date(bal.last_settled_at).toLocaleString()}. These numbers reset to zero at every settlement.</>
                  : 'Current cycle — all activity (no settlements yet). These numbers reset to zero at every settlement.'}
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payments collected this cycle (verified, net of refunds)</span>
                <span className="tabular-nums">{money(bal.collected_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Sales rep commissions outstanding</span>
                <span className="tabular-nums text-red-600">−{money(bal.rep_commissions_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Warehouse shipping outstanding</span>
                <span className="tabular-nums text-red-600">−{money(bal.warehouse_earned_usd)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <span>Vendor share (this cycle)</span>
                <span className="tabular-nums">{money(bal.vendor_share_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Vendor payments this cycle</span>
                <span className="tabular-nums text-red-600">−{money(bal.vendor_paid_usd)}</span>
              </div>
              {Math.abs(Number(bal.carried_adjustment_usd)) >= 0.01 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">± Carried from before last settlement</span>
                  <span className="tabular-nums">{Number(bal.carried_adjustment_usd) >= 0 ? '+' : '−'}{money(Math.abs(Number(bal.carried_adjustment_usd)))}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                <span>Balance owed to vendor</span>
                <span className={`tabular-nums ${Number(bal.balance_owed_usd) > 0 ? 'text-green-700' : ''}`}>{money(bal.balance_owed_usd)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Rep commissions accrue on confirmed+ orders (10%); warehouse earnings accrue per shipped
                shipment at the rate plan. Both are counted when earned, not when paid out. Lifetime stamped
                totals live in Settlement History below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Settlement History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Stamped At</TableHead>
                <TableHead className="text-right">Reps Paid</TableHead>
                <TableHead className="text-right">Warehouses Paid</TableHead>
                <TableHead className="text-right">Vendor Paid</TableHead>
                <TableHead className="text-right">Collected (lifetime)</TableHead>
                <TableHead>By / Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">#{s.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(s.settled_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(s.rep_commissions_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(s.warehouse_earned_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(s.vendor_share_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{money(s.collected_usd)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{s.created_by || '—'}{s.note ? ` · ${s.note}` : ''}</TableCell>
                </TableRow>
              ))}
              {settlements.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-6">No settlements yet — Settle All Now stamps and zeroes every balance in one step.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
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

      <Dialog open={settleOpen} onOpenChange={v => !v && !settling && setSettleOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Settle All — stamp &amp; zero every balance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This stamps the value of everything <span className="font-medium">right now</span> in one atomic step:
              a payout is recorded for every positive rep balance, warehouse balance, and the vendor share.
              All of those read <span className="font-medium">zero</span> afterward; new activity counts toward
              the next settlement. (Overpaid — negative — balances aren&apos;t clawed back; they carry forward
              and offset the payee&apos;s next accruals.)
            </p>
            <div className="rounded border bg-slate-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Rep commissions to pay</span><span className="tabular-nums">{money(repOwedTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Warehouse balances to pay</span><span className="tabular-nums">{money(whOwedTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor share to pay</span><span className="tabular-nums">{bal ? money(Math.max(0, Number(bal.balance_owed_usd))) : '—'}</span></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><span>Total leaving the wallet</span><span className="tabular-nums">{bal ? money(repOwedTotal + whOwedTotal + Math.max(0, Number(bal.balance_owed_usd))) : '—'}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Send the actual crypto to each payee (their addresses are on the Rep/Warehouse tabs), then
              confirm here. The exact amounts are re-computed at the moment you confirm — the stamp and the
              recorded payouts can never disagree.
            </p>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={settleNote} onChange={e => setSettleNote(e.target.value)} placeholder="e.g. July settlement — wallet emptied to vendor" rows={2} />
            </div>
            {settleErr && <p className="text-sm text-red-600">{settleErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={settling}>Cancel</Button>
            <Button onClick={handleSettle} disabled={settling}>{settling ? 'Settling…' : 'Stamp & Settle All'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
