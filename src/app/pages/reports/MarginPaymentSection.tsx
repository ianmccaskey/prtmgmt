import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { DateRange, exportCSV } from './dateRangeUtils';
import getCOGSMargin from '@/actions/reports/getCOGSMargin';
import getMarginTrend from '@/actions/reports/getMarginTrend';
import getPaymentMethodBreakdown from '@/actions/reports/getPaymentMethodBreakdown';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type COGSRow = { product_id: number; sku: string; product_name: string; units_sold: number; revenue: number; cogs: number; gross_margin_usd: number; gross_margin_pct: number };
type MarginTrendRow = { month: string; revenue: number; cogs: number; gross_margin: number };
type PaymentRow = { asset: string; network: string; asset_network: string; tx_count: number; total_usd: number; avg_usd: number };

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Number(n).toFixed(0)}`;

interface Props { range: DateRange }

export function MarginPaymentSection({ range }: Props) {
  const params = { date_from: range.from || null, date_to: range.to || null };

  const [cogs] = useLoadAction(getCOGSMargin, [], params);
  const [marginTrend] = useLoadAction(getMarginTrend, [], params);
  const [payments] = useLoadAction(getPaymentMethodBreakdown, [], params);

  const cogsList = (cogs as COGSRow[]) || [];
  const trendList = (marginTrend as MarginTrendRow[]) || [];
  const paymentList = (payments as PaymentRow[]) || [];

  const totalPayments = paymentList.reduce((sum, r) => sum + Number(r.total_usd), 0);

  return (
    <div className="space-y-6">
      {/* COGS Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">COGS & Margin Analysis</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Admin only</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV('cogs_margin.csv', cogsList as unknown as Record<string, unknown>[])}>
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross Margin</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cogsList.map(r => (
                  <TableRow key={r.product_id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.product_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.sku}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{Number(r.units_sold).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">${Number(r.revenue).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">${Number(r.cogs).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-sm">${Number(r.gross_margin_usd).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={Number(r.gross_margin_pct) >= 50 ? 'bg-green-100 text-green-700' : Number(r.gross_margin_pct) >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                        {Number(r.gross_margin_pct).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {cogsList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Margin Trend Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Gross Margin Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendList} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cogs" name="COGS" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gross_margin" name="Gross Margin" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Method Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentList}
                  dataKey="total_usd"
                  nameKey="asset_network"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={({ asset_network, percent }) => `${asset_network} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {paymentList.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Details</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset/Network</TableHead>
                  <TableHead className="text-right">Txs</TableHead>
                  <TableHead className="text-right">Total USD</TableHead>
                  <TableHead className="text-right">Avg USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentList.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-mono text-sm">{r.asset_network}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.tx_count}</TableCell>
                    <TableCell className="text-right font-medium text-sm">${Number(r.total_usd).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">${Number(r.avg_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
                {paymentList.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {paymentList.length > 0 && (
              <div className="px-4 py-2 border-t text-sm text-gray-500">
                Total: <span className="font-semibold text-gray-900">${totalPayments.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
