'use client';

import '@/index.css';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppUserProvider, RequireRole } from '@/app/AppContext';
import { AppLayout } from '@/app/layout/AppLayout';
import { HomePage } from '@/app/pages/HomePage';
import { OrdersPage } from '@/app/pages/orders/OrdersPage';
import { CustomersPage } from '@/app/pages/customers/CustomersPage';
import { CustomerDetailPage } from '@/app/pages/customers/CustomerDetailPage';
import { ProductsPage } from '@/app/pages/products/ProductsPage';
import { ProductDetailPage } from '@/app/pages/products/ProductDetailPage';
import { BatchesPage } from '@/app/pages/batches/BatchesPage';
import { BatchDetailPage } from '@/app/pages/batches/BatchDetailPage';
import { WarehousePage } from '@/app/pages/warehouse/WarehousePage';
import { LogisticsPage } from '@/app/pages/logistics/LogisticsPage';
import { ShipmentDetailPage } from '@/app/pages/logistics/ShipmentDetailPage';
import { ReportsPage } from '@/app/pages/reports/ReportsPage';
import { CommissionsPage } from '@/app/pages/commissions/CommissionsPage';
import { SettingsPage } from '@/app/pages/settings/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <AppUserProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<RequireRole roles={['admin', 'sales_rep']}><CustomersPage /></RequireRole>} />
            <Route path="/customers/:id" element={<RequireRole roles={['admin', 'sales_rep']}><CustomerDetailPage /></RequireRole>} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/batches/:id" element={<BatchDetailPage />} />
            <Route path="/warehouse" element={<WarehousePage />} />
            <Route path="/logistics" element={<LogisticsPage />} />
            <Route path="/logistics/:id" element={<ShipmentDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/commissions" element={<RequireRole roles={['admin']}><CommissionsPage /></RequireRole>} />
            <Route path="/settings" element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
          </Routes>
        </AppLayout>
      </AppUserProvider>
    </BrowserRouter>
  );
}

export default App;
