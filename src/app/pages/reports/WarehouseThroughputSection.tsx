import React from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download } from 'lucide-react';
import { DateRange, exportCSV } from './dateRangeUtils';
import getWarehouseThroughput from '@/actions/reports/getWarehouseThroughput';
import getWarehouseThroughputSummary from '@/actions/reports/getWarehouseThroughputSummary';
import { useAppUser } from '@/app/AppContext';

type ThroughputRow = { warehouse_id: number; warehouse_name: string; month: string; kits_shipped: number; shipping_cost: number };
type SummaryRow = { warehouse_id: number; warehouse_name: string; total_kits_shipped: number; avg_kits_per_month: number; total_shipping_cost: number; avg_cost_per_kit: number };

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface Props { range: DateRange }

export function WarehouseThroughputSection({ range }: Props) {
  const { isAdmin, isWarehouse, assignedWarehouseId } = useAppUser();
  // Warehouse role only sees its own warehouse; internal costs are admin-only.
  const scopedWarehouseId = isWarehouse ? assignedWarehouseId : null;
  const params = { date_from: range.from || null, date_to: range.to || null, warehouse_id: scopedWarehouseId };
  const [throughput] = useLoadAction(getWarehouseThroughput, [range.from, range.to, scopedWarehouseId], params);
  const [summary] = useLoadAction(getWarehouseThroughputSummary, [range.from, range.to, scopedWarehouseId], params);

  const rows = asRows<ThroughputRow>(throughput);
  const summaryRows = asRows<SummaryRow>(summary);
  const exportRows = isAdmin
    ? summaryRows
    : summaryRows.map(({ total_shipping_cost: _c, avg_cost_per_kit: _a, ...rest }) => rest);

  // Pivot data: { month, [warehouse]: kits }
  const warehouses = [...new Set(rows.map(r => r.warehouse_name))];
  const months = [...new Set(rows.map(r => r.month))].sort();
  const chartData = months.map(month => {
    const entry: Record<string, string | number> = { month };
    for (const wh of warehouses) {
      const r = rows.find(row => row.month === month && row.warehouse_name === wh);
      entry[wh] = r ? Number(r.kits_shipped) : 0;
    }
    return entry;
  });

  return (
    <div className="space-y-6">
      {/* Grouped Bar Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Kits Shipped per Warehouse per Month</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {warehouses.map((wh, i) => (
                <Bar key={wh} dataKey={wh} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Warehouse Summary</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportCSV('warehouse_throughput.csv', exportRows as unknown as Record<string, unknown>[])}>
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Total Kits Shipped</TableHead>
                <TableHead className="text-right">Avg Kits/Month</TableHead>
                {isAdmin && <TableHead className="text-right">Total Shipping Cost</TableHead>}
                {isAdmin && <TableHead className="text-right">Avg Cost/Kit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.map(r => (
                <TableRow key={r.warehouse_id}>
                  <TableCell className="font-medium text-sm">{r.warehouse_name}</TableCell>
                  <TableCell className="text-right">{Number(r.total_kits_shipped).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(r.avg_kits_per_month).toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                  {isAdmin && <TableCell className="text-right">${Number(r.total_shipping_cost).toLocaleString()}</TableCell>}
                  {isAdmin && <TableCell className="text-right">${Number(r.avg_cost_per_kit).toFixed(2)}</TableCell>}
                </TableRow>
              ))}
              {summaryRows.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 5 : 3} className="text-center py-6 text-gray-400">No data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
