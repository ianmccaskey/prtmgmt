import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepCommissionsTab } from './RepCommissionsTab';
import { WarehouseCommissionsTab } from './WarehouseCommissionsTab';
import { CommissionReportsTab } from './CommissionReportsTab';
import { VendorTab } from './VendorTab';
import { HandCoins } from 'lucide-react';

export function CommissionsPage() {
  // US-only by design: China-division customers pay their rep's own
  // external wallet before the order is entered — the app tracks no China
  // money (no collections, commissions, or settlements). The division
  // params on the underlying actions stay (defaulting 'us'), which also
  // keeps China reps and their orders excluded from every figure here.
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-emerald-600" />
          Commissions
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sales rep and warehouse commission balances, payments, and reports (US division)</p>
      </div>

      <Tabs defaultValue="reps">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="reps">Sales Rep Commissions</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouse Commissions</TabsTrigger>
          <TabsTrigger value="vendor">Vendor Owed</TabsTrigger>
          <TabsTrigger value="reports">Payment Ledger & Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reps" className="mt-6">
          <RepCommissionsTab division="us" />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-6">
          <WarehouseCommissionsTab />
        </TabsContent>

        <TabsContent value="vendor" className="mt-6">
          <VendorTab division="us" />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <CommissionReportsTab division="us" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
