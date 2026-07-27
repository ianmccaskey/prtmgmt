import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepCommissionsTab } from './RepCommissionsTab';
import { WarehouseCommissionsTab } from './WarehouseCommissionsTab';
import { CommissionReportsTab } from './CommissionReportsTab';
import { VendorTab } from './VendorTab';
import { HandCoins } from 'lucide-react';

export function CommissionsPage() {
  // The two divisions are fully parallel pipelines — separate reps,
  // wallets, collections, and settlements. Everything below the toggle is
  // scoped to one of them. Warehouses exist only in the US pipeline.
  const [division, setDivision] = useState<'us' | 'china'>('us');
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-emerald-600" />
            Commissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sales rep and warehouse commission balances, payments, and reports</p>
        </div>
        <div className="flex rounded-md border overflow-hidden text-sm">
          <button
            className={`px-4 py-1.5 ${division === 'us' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setDivision('us')}
          >US</button>
          <button
            className={`px-4 py-1.5 ${division === 'china' ? 'bg-red-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setDivision('china')}
          >China</button>
        </div>
      </div>
      {division === 'china' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          China division — balances, collections, wallets, and settlements here are fully separate from the US
          pipeline. Warehouse shipping earnings always live in the US view.
        </p>
      )}

      <Tabs defaultValue="reps">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="reps">Sales Rep Commissions</TabsTrigger>
          {division === 'us' && <TabsTrigger value="warehouses">Warehouse Commissions</TabsTrigger>}
          <TabsTrigger value="vendor">Vendor Owed</TabsTrigger>
          <TabsTrigger value="reports">Payment Ledger & Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reps" className="mt-6">
          <RepCommissionsTab division={division} />
        </TabsContent>

        {division === 'us' && (
          <TabsContent value="warehouses" className="mt-6">
            <WarehouseCommissionsTab />
          </TabsContent>
        )}

        <TabsContent value="vendor" className="mt-6">
          <VendorTab division={division} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <CommissionReportsTab division={division} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
