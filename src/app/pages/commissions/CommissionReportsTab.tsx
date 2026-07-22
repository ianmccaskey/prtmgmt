import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { DateRangePicker } from '@/app/pages/reports/DateRangePicker';
import { DateRange, getPresetRange, exportCSV } from '@/app/pages/reports/dateRangeUtils';
import getCommissionSummary from '@/actions/commissions/getCommissionSummary';
import listCommissionPayments from '@/actions/commissions/listCommissionPayments';

type Summary = {
  rep_commission_earned_usd: number; rep_commission_paid_usd: number;
  warehouse_commission_earned_usd: number; warehouse_commission_paid_usd: number;
};

type Payment = {
  id: number; payee_type: 'sales_rep' | 'warehouse' | 'vendor'; amount_usd: number;
  paid_at: string; note: string; sales_rep_name: string; warehouse_name: string;
};

const money = (v: number | string) => `$${Number(v).toFixed(2)}`;

export function CommissionReportsTab() {
  const [preset, setPreset] = useState('this_year');
  const [range, setRange] = useState<DateRange>(() => getPresetRange('this_year'));
  const [payeeFilter, setPayeeFilter] = useState<string>('all');

  const handlePresetChange = (p: string, r: DateRange) => {
    setPreset(p);
    setRange(r);
  };

  const [summaryRaw] = useLoadAction(getCommissionSummary, [range.from, range.to], {
    date_from: range.from || null, date_to: range.to || null,
  });
  const [paymentsRaw] = useLoadAction(listCommissionPayments, [range.from, range.to, payeeFilter], {
    payee_type: payeeFilter === 'all' ? null : payeeFilter,
    date_from: range.from || null, date_to: range.to || null,
  });

  const summary = (Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw) as Summary | undefined;
  const paymentList = asRows<Payment>(paymentsRaw);

  const totalEarned = Number(summary?.rep_commission_earned_usd || 0) + Number(summary?.warehouse_commission_earned_usd || 0);
  const totalPaid = Number(summary?.rep_commission_paid_usd || 0) + Number(summary?.warehouse_commission_paid_usd || 0);
  const totalOutstanding = totalEarned - totalPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRangePicker range={range} preset={preset} onPresetChange={handlePresetChange} onRangeChange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Commission Earned</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{money(totalEarned)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Paid Out</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{money(totalPaid)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{money(totalOutstanding)}</p>
              </div>
              <Scale className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales Rep Commissions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Earned</span><span className="font-medium">{money(summary?.rep_commission_earned_usd || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-medium">{money(summary?.rep_commission_paid_usd || 0)}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-500">Outstanding</span><span className="font-semibold">{money(Number(summary?.rep_commission_earned_usd || 0) - Number(summary?.rep_commission_paid_usd || 0))}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Warehouse Commissions</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Earned</span><span className="font-medium">{money(summary?.warehouse_commission_earned_usd || 0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-medium">{money(summary?.warehouse_commission_paid_usd || 0)}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-500">Outstanding</span><span className="font-semibold">{money(Number(summary?.warehouse_commission_earned_usd || 0) - Number(summary?.warehouse_commission_paid_usd || 0))}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Payment Ledger</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={payeeFilter} onValueChange={setPayeeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payees</SelectItem>
                <SelectItem value="sales_rep">Sales Reps</SelectItem>
                <SelectItem value="warehouse">Warehouses</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={!paymentList.length} onClick={() => exportCSV('commission_payments.csv', paymentList as unknown as Record<string, unknown>[])}>
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payee Type</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentList.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.paid_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{p.payee_type === 'sales_rep' ? 'Sales Rep' : p.payee_type === 'warehouse' ? 'Warehouse' : 'Vendor'}</Badge></TableCell>
                  <TableCell className="font-medium">{p.payee_type === 'sales_rep' ? p.sales_rep_name : p.payee_type === 'warehouse' ? p.warehouse_name : 'Vendor'}</TableCell>
                  <TableCell className="text-right">{money(p.amount_usd)}</TableCell>
                  <TableCell className="text-gray-500">{p.note || '—'}</TableCell>
                </TableRow>
              ))}
              {paymentList.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">No payments recorded in this range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
