import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from './DateRangePicker';
import { RevenueTrendsSection } from './RevenueTrendsSection';
import { TopTablesSection } from './TopTablesSection';
import { WarehouseThroughputSection } from './WarehouseThroughputSection';
import { MarginPaymentSection } from './MarginPaymentSection';
import { DateRange, getPresetRange } from './dateRangeUtils';
import { BarChart2 } from 'lucide-react';

export function ReportsPage() {
  const [preset, setPreset] = useState('this_year');
  const [range, setRange] = useState<DateRange>(() => getPresetRange('this_year'));

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
        <DateRangePicker
          range={range}
          preset={preset}
          onPresetChange={handlePresetChange}
          onRangeChange={r => setRange(r)}
        />
      </div>

      {/* Sections */}
      <Tabs defaultValue="revenue">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="tables">Top Customers & Products</TabsTrigger>
          <TabsTrigger value="throughput">Warehouse Throughput</TabsTrigger>
          <TabsTrigger value="margin">Margin & Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-6">
          <RevenueTrendsSection range={range} />
        </TabsContent>

        <TabsContent value="tables" className="mt-6">
          <TopTablesSection range={range} />
        </TabsContent>

        <TabsContent value="throughput" className="mt-6">
          <WarehouseThroughputSection range={range} />
        </TabsContent>

        <TabsContent value="margin" className="mt-6">
          <MarginPaymentSection range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
