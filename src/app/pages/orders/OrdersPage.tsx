import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrdersStatStrip } from './OrdersStatStrip';
import { AllOrdersTab } from './AllOrdersTab';
import { ChinaDirectTab } from './ChinaDirectTab';
import { RefundsTab } from './RefundsTab';

export function OrdersPage() {
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
          <TabsTrigger value="china">China-Direct Queue</TabsTrigger>
          <TabsTrigger value="refunds">Refunds Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <AllOrdersTab />
        </TabsContent>

        <TabsContent value="china" className="pt-4">
          <ChinaDirectTab />
        </TabsContent>

        <TabsContent value="refunds" className="pt-4">
          <RefundsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
