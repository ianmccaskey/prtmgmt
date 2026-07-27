import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from './DateRangePicker';
import { RevenueTrendsSection } from './RevenueTrendsSection';
import { TopTablesSection } from './TopTablesSection';
import { WarehouseThroughputSection } from './WarehouseThroughputSection';
import { MarginPaymentSection } from './MarginPaymentSection';
import { DateRange, getPresetRange } from './dateRangeUtils';
import { BarChart2 } from 'lucide-react';
import { useAppUser } from '@/app/AppContext';

export function ReportsPage() {
  const { isAdmin, isWarehouse, isLogistics } = useAppUser();
  // Financial reports are part of the logistics coordinator's job.
  const seesFinancials = isAdmin || isLogistics;
  const [preset, setPreset] = useState('this_year');
  const [range, setRange] = useState<DateRange>(() => getPresetRange('this_year'));
  // Rep-division segmentation: '' = all divisions combined.
  const [division, setDivision] = useState('');

  const handlePresetChange = (p: string, r: DateRange) => {
    setPreset(p);
    setRange(r);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-500" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">Business intelligence across sales, customers, products, and operations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isWarehouse && (
            <Select value={division || '_all'} onValueChange={v => setDivision(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Division" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All divisions</SelectItem>
                <SelectItem value="us">US</SelectItem>
                <SelectItem value="china">China</SelectItem>
              </SelectContent>
            </Select>
          )}
          <DateRangePicker
            range={range}
            preset={preset}
            onPresetChange={handlePresetChange}
            onRangeChange={r => setRange(r)}
          />
        </div>
      </div>

      {/* Warehouse role only sees throughput (scoped to their warehouse) */}
      <Tabs defaultValue={isWarehouse ? 'throughput' : 'revenue'}>
        <TabsList className="flex-wrap h-auto gap-1">
          {!isWarehouse && <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>}
          {!isWarehouse && <TabsTrigger value="tables">Top Customers & Products</TabsTrigger>}
          <TabsTrigger value="throughput">Warehouse Throughput</TabsTrigger>
          {seesFinancials && <TabsTrigger value="margin">Margin & Payments</TabsTrigger>}
        </TabsList>

        {!isWarehouse && (
          <TabsContent value="revenue" className="mt-6">
            <RevenueTrendsSection range={range} division={division} />
          </TabsContent>
        )}

        {!isWarehouse && (
          <TabsContent value="tables" className="mt-6">
            <TopTablesSection range={range} division={division} />
          </TabsContent>
        )}

        <TabsContent value="throughput" className="mt-6">
          <WarehouseThroughputSection range={range} />
        </TabsContent>

        {seesFinancials && (
          <TabsContent value="margin" className="mt-6">
            <MarginPaymentSection range={range} division={division} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
