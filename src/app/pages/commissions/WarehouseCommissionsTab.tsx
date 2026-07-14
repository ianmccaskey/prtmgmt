import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Warehouse, Receipt } from 'lucide-react';
import { exportCSV } from '@/app/pages/reports/dateRangeUtils';
import listWarehouseBalances from '@/actions/commissions/listWarehouseBalances';
import listWarehouseCommissionShipments from '@/actions/commissions/listWarehouseCommissionShipments';
import recordCommissionPayment from '@/actions/commissions/recordCommissionPayment';

type WarehouseBalance = {
  warehouse_id: number; warehouse_name: string;
  commission_earned_usd: number; paid_total_usd: number; balance_owed_usd: number; shipments_count: number;
};

type WarehouseShipment = {
  shipment_id: number; sales_order_id: number; order_number: string; shipped_date: string;
  carrier: string; internal_shipping_cost_usd: number; warehouse_name: string; total_kits: number;
};

const money = (v: number | string) => `$${Number(v).toFixed(2)}`;

export function WarehouseCommissionsTab() {
  const [payDialogWh, setPayDialogWh] = useState<WarehouseBalance | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedWhId, setSelectedWhId] = useState<number | null>(null);

  const [balances, , , reloadBalances] = useLoadAction(listWarehouseBalances, [], {});
  const [shipments] = useLoadAction(listWarehouseCommissionShipments, [selectedWhId], {
    warehouse_id: selectedWhId, date_from: null, date_to: null,
  }, { enabled: selectedWhId !== null });
  const [doPay] = useMutateAction(recordCommissionPayment);

  const balanceList = (balances as WarehouseBalance[]) || [];
  const shipmentList = ((shipments as WarehouseShipment[]) || []).filter(Boolean);

  const openPay = (wh: WarehouseBalance) => {
    setPayDialogWh(wh);
    setAmount('');
    setNote('');
    setError('');
  };

  const handlePay = async () => {
    if (!payDialogWh) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    setSaving(true); setError('');
    try {
      await doPay({
        payee_type: 'warehouse',
        sales_rep_user_profile_id: null,
        warehouse_id: payDialogWh.warehouse_id,
        amount_usd: amt,
        paid_by_user_id: 1,
        note: note || null,
      });
      setPayDialogWh(null);
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
            <Warehouse className="h-4 w-4 text-blue-600" /> Warehouse Commission Balances
          </CardTitle>
          <p className="text-xs text-gray-500">$18 flat per shipment up to 6 kits, +$8 per additional tier of 6, plus expedited cost</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Shipments</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance Owed</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balanceList.map(wh => (
                <TableRow
                  key={wh.warehouse_id}
                  className={selectedWhId === wh.warehouse_id ? 'bg-blue-50/60' : 'cursor-pointer hover:bg-gray-50'}
                  onClick={() => setSelectedWhId(wh.warehouse_id)}
                >
                  <TableCell className="font-medium">{wh.warehouse_name}</TableCell>
                  <TableCell className="text-right">{wh.shipments_count}</TableCell>
                  <TableCell className="text-right">{money(wh.commission_earned_usd)}</TableCell>
                  <TableCell className="text-right">{money(wh.paid_total_usd)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={Number(wh.balance_owed_usd) > 0 ? 'default' : 'secondary'}>
                      {money(wh.balance_owed_usd)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openPay(wh); }}>
                      Record Payment
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {balanceList.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">No warehouses found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gray-500" />
            {selectedWhId ? `Commission Detail — ${balanceList.find(w => w.warehouse_id === selectedWhId)?.warehouse_name || ''}` : 'Commission Detail — select a warehouse above'}
          </CardTitle>
          <Button
            variant="outline" size="sm" disabled={!shipmentList.length}
            onClick={() => exportCSV('warehouse_commissions.csv', shipmentList as unknown as Record<string, unknown>[])}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Shipped</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead className="text-right">Kits</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipmentList.map(s => (
                <TableRow key={s.shipment_id}>
                  <TableCell className="font-medium">{s.order_number}</TableCell>
                  <TableCell>{s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell><Badge variant="outline">{s.carrier || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{s.total_kits}</TableCell>
                  <TableCell className="text-right font-medium">{money(s.internal_shipping_cost_usd)}</TableCell>
                </TableRow>
              ))}
              {shipmentList.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">
                  {selectedWhId ? 'No commission shipments found.' : 'Select a warehouse to see shipment-level detail.'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!payDialogWh} onOpenChange={(o) => !o && setPayDialogWh(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {payDialogWh?.warehouse_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Current balance owed: <span className="font-medium text-gray-900">{payDialogWh ? money(payDialogWh.balance_owed_usd) : ''}</span>
            </p>
            <div>
              <Label>Payment Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via wire transfer" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogWh(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
