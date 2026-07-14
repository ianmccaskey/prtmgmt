import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrdersStatStrip } from './OrdersStatStrip';
import { AllOrdersTab } from './AllOrdersTab';
import { ChinaDirectTab } from './ChinaDirectTab';
import { RefundsTab } from './RefundsTab';
import { useAppUser } from '@/app/AppContext';

export function OrdersPage() {
  // Access matrix: warehouse role gets a read-only All Orders view;
  // China-Direct and Refunds queues are hidden for warehouse users.
  const { isWarehouse } = useAppUser();
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Sales Orders</h1>
        <p className="text-sm text-muted-foreground">Manage orders, track payments, and fulfill shipments</p>
      </div>

      <OrdersStatStrip />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Orders</TabsTrigger>
          {!isWarehouse && <TabsTrigger value="china">China-Direct Queue</TabsTrigger>}
          {!isWarehouse && <TabsTrigger value="refunds">Refunds Queue</TabsTrigger>}
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <AllOrdersTab />
        </TabsContent>

        {!isWarehouse && (
          <TabsContent value="china" className="pt-4">
            <ChinaDirectTab />
          </TabsContent>
        )}

        {!isWarehouse && (
          <TabsContent value="refunds" className="pt-4">
            <RefundsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
