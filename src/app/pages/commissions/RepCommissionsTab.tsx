import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, Receipt } from 'lucide-react';
import { exportCSV } from '@/app/pages/reports/dateRangeUtils';
import listRepBalances from '@/actions/commissions/listRepBalances';
import listRepCommissionOrders from '@/actions/commissions/listRepCommissionOrders';
import recordCommissionPayment from '@/actions/commissions/recordCommissionPayment';

type RepBalance = {
  sales_rep_user_profile_id: number; display_name: string;
  commission_earned_usd: number; paid_total_usd: number; balance_owed_usd: number; orders_count: number;
};

type RepOrder = {
  sales_order_id: number; order_number: string; order_date: string; status: string;
  total_usd: number; commission_usd: number; sales_rep_name: string; customer_name: string;
};

const money = (v: number | string) => `$${Number(v).toFixed(2)}`;

export function RepCommissionsTab() {
  const { profileId, isAdmin } = useAppUser();
  const [payDialogRep, setPayDialogRep] = useState<RepBalance | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);

  const [balances, , , reloadBalances] = useLoadAction(listRepBalances, [], {});
  const [orders] = useLoadAction(listRepCommissionOrders, [selectedRepId], {
    sales_rep_user_profile_id: selectedRepId, date_from: null, date_to: null,
  }, { enabled: selectedRepId !== null });
  const [doPay] = useMutateAction(recordCommissionPayment);

  const balanceList = asRows<RepBalance>(balances);
  const orderList = (asRows<RepOrder>(orders)).filter(Boolean);

  const openPay = (rep: RepBalance) => {
    setPayDialogRep(rep);
    setAmount('');
    setNote('');
    setError('');
  };

  const handlePay = async () => {
    if (!payDialogRep) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    setSaving(true); setError('');
    try {
      await doPay({
        payee_type: 'sales_rep',
        sales_rep_user_profile_id: payDialogRep.sales_rep_user_profile_id,
        warehouse_id: null,
        amount_usd: amt,
        paid_by_user_id: profileId,
        note: note || null,
      });
      setPayDialogRep(null);
      reloadBalances();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Sales Rep Commission Balances
          </CardTitle>
          <p className="text-xs text-gray-500">10% of order total, excluding cancelled orders</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance Owed</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanceList.map(rep => (
                <TableRow
                  key={rep.sales_rep_user_profile_id}
                  className={selectedRepId === rep.sales_rep_user_profile_id ? 'bg-blue-50/60' : 'cursor-pointer hover:bg-gray-50'}
                  onClick={() => setSelectedRepId(rep.sales_rep_user_profile_id)}
                >
                  <TableCell className="font-medium">{rep.display_name}</TableCell>
                  <TableCell className="text-right">{rep.orders_count}</TableCell>
                  <TableCell className="text-right">{money(rep.commission_earned_usd)}</TableCell>
                  <TableCell className="text-right">{money(rep.paid_total_usd)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={Number(rep.balance_owed_usd) > 0 ? 'default' : 'secondary'}>
                      {money(rep.balance_owed_usd)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openPay(rep); }}>
                      Record Payment
                    </Button>}
                  </TableCell>
                </TableRow>
              ))}
              {balanceList.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">No sales reps found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gray-500" />
            {selectedRepId ? `Commission Detail — ${balanceList.find(r => r.sales_rep_user_profile_id === selectedRepId)?.display_name || ''}` : 'Commission Detail — select a rep above'}
          </CardTitle>
          <Button
            variant="outline" size="sm" disabled={!orderList.length}
            onClick={() => exportCSV('rep_commissions.csv', orderList as unknown as Record<string, unknown>[])}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Order Total</TableHead>
                <TableHead className="text-right">Commission (10%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderList.map(o => (
                <TableRow key={o.sales_order_id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{new Date(o.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>{o.customer_name}</TableCell>
                  <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                  <TableCell className="text-right">{money(o.total_usd)}</TableCell>
                  <TableCell className="text-right font-medium">{money(o.commission_usd)}</TableCell>
                </TableRow>
              ))}
              {orderList.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">
                  {selectedRepId ? 'No commission orders found.' : 'Select a rep to see order-level detail.'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!payDialogRep} onOpenChange={(o) => !o && setPayDialogRep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {payDialogRep?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Current balance owed: <span className="font-medium text-gray-900">{payDialogRep ? money(payDialogRep.balance_owed_usd) : ''}</span>
            </p>
            <div>
              <Label>Payment Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via Zelle" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogRep(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
