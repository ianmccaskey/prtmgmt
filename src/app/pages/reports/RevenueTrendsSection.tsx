import React from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import { DateRange } from './dateRangeUtils';
import getRevenueByMonth from '@/actions/reports/getRevenueByMonth';
import getRevenueByQuarter from '@/actions/reports/getRevenueByQuarter';
import getRevenueKPIs from '@/actions/reports/getRevenueKPIs';

type MonthRow = { month: string; warehouse_revenue: number; china_direct_revenue: number; total_revenue: number };
type KPIRow = { total_revenue: number; order_count: number; avg_monthly_revenue: number; prior_revenue: number; growth_pct: number | null };

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Number(n).toFixed(0)}`;

interface Props { range: DateRange }

export function RevenueTrendsSection({ range }: Props) {
  const params = { date_from: range.from || null, date_to: range.to || null };

  // Prior period: same length before from
  const priorTo = range.from || null;
  const priorFrom = (() => {
    if (!range.from || !range.to) return null;
    const days = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000;
    const d = new Date(range.from);
    d.setDate(d.getDate() - Math.round(days) - 1);
    return d.toISOString().split('T')[0];
  })();

  const [monthly] = useLoadAction(getRevenueByMonth, [], params);
  const [quarterly] = useLoadAction(getRevenueByQuarter, [], params);
  const [kpis] = useLoadAction(getRevenueKPIs, [], { ...params, prior_from: priorFrom, prior_to: priorTo });

  const monthRows = asRows<MonthRow>(monthly);
  const quarterRows = asRows<MonthRow>(quarterly);
  const kpiRow = (asRows<KPIRow>(kpis))[0] || {} as KPIRow;

  const growthPct = kpiRow.growth_pct != null ? Number(kpiRow.growth_pct) : null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-500">Total Revenue</span>
            </div>
            <div className="text-2xl font-bold">${Number(kpiRow.total_revenue || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-500">Avg Monthly Revenue</span>
            </div>
            <div className="text-2xl font-bold">${Number(kpiRow.avg_monthly_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-gray-500">Orders</span>
            </div>
            <div className="text-2xl font-bold">{Number(kpiRow.order_count || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              {growthPct != null && growthPct >= 0
                ? <TrendingUp className="h-4 w-4 text-green-500" />
                : <TrendingDown className="h-4 w-4 text-red-500" />}
              <span className="text-xs text-gray-500">Growth vs Prior Period</span>
            </div>
            <div className={`text-2xl font-bold ${growthPct != null && growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthPct != null ? `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Line Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="warehouse_revenue" name="Warehouse" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="china_direct_revenue" name="China Direct" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quarterly Bar Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Quarterly Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={quarterRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="warehouse_revenue" name="Warehouse" fill="#3b82f6" stackId="a" />
              <Bar dataKey="china_direct_revenue" name="China Direct" fill="#f59e0b" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
