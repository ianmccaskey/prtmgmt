import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehousesTab } from './WarehousesTab';
import { RatePlansTab } from './RatePlansTab';
import { WalletsReasonsTab } from './WalletsReasonsTab';
import { ReorderUsersTab } from './ReorderUsersTab';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-600" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Admin configuration for warehouses, rates, wallets, and users</p>
      </div>

      <Tabs defaultValue="warehouses">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="rate_plans">Rate Plans</TabsTrigger>
          <TabsTrigger value="wallets">Wallets & Reasons</TabsTrigger>
          <TabsTrigger value="reorder">Reorder & Users</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="mt-6">
          <WarehousesTab />
        </TabsContent>

        <TabsContent value="rate_plans" className="mt-6">
          <RatePlansTab />
        </TabsContent>

        <TabsContent value="wallets" className="mt-6">
          <WalletsReasonsTab />
        </TabsContent>

        <TabsContent value="reorder" className="mt-6">
          <ReorderUsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
