import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepCommissionsTab } from './RepCommissionsTab';
import { WarehouseCommissionsTab } from './WarehouseCommissionsTab';
import { CommissionReportsTab } from './CommissionReportsTab';
import { HandCoins } from 'lucide-react';

export function CommissionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-emerald-600" />
          Commissions
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sales rep and warehouse commission balances, payments, and reports</p>
      </div>

      <Tabs defaultValue="reps">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="reps">Sales Rep Commissions</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouse Commissions</TabsTrigger>
          <TabsTrigger value="reports">Payment Ledger & Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reps" className="mt-6">
          <RepCommissionsTab />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-6">
          <WarehouseCommissionsTab />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <CommissionReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
