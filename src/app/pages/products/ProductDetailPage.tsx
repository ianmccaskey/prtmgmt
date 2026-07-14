import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import getProductDetailAction from '@/actions/products/getProductDetail';
import listFactoriesAction from '@/actions/products/listFactories';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, ExternalLink } from 'lucide-react';
import { ProductDetailsTab } from '@/app/pages/products/ProductDetailsTab';
import { ProductPricingTab } from '@/app/pages/products/ProductPricingTab';
import { ProductBatchesTab } from '@/app/pages/products/ProductBatchesTab';
import { ProductTestResultsTab } from '@/app/pages/products/ProductTestResultsTab';
import { ProductInventoryTab } from '@/app/pages/products/ProductInventoryTab';

type Product = {
  id: number; sku: string; name: string; description: string; category: string;
  vial_size_ml: number; vials_per_unit: number; list_price: number; currency: string;
  standard_cost: number; available_warehouse: boolean; available_china_direct: boolean;
  factory_id: number; factory_name: string; is_active: boolean; low_stock_threshold: number;
  total_stock: number; total_available: number; batch_count: number; updated_at: string;
};

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, loading] = useLoadAction(getProductDetailAction, [], { id });
  const [factories] = useLoadAction(listFactoriesAction, [], {});
  const p: Product | null = Array.isArray(product) && product.length > 0 ? product[0] : null;
  const factoryList: { id: number; name: string }[] = Array.isArray(factories) ? factories : [];

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
  if (!p) return <div className="p-6 text-slate-500">Product not found.</div>;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/products')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Package className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">{p.name}</h1>
            <Badge variant="outline" className="text-xs font-mono">{p.sku}</Badge>
            <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
          <p className="text-sm text-slate-500">{p.category} · {p.vial_size_ml}mL × {p.vials_per_unit} vials · Factory: {p.factory_name || '—'}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-800">${Number(p.list_price).toFixed(2)}</div>
          <div className="text-xs text-slate-400">{p.total_available} available / {p.total_stock} on hand</div>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <ProductDetailsTab product={p} factories={factoryList} />
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <ProductPricingTab productId={Number(id)} listPrice={p.list_price} standardCost={p.standard_cost} />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <ProductBatchesTab productId={Number(id)} productName={p.name} hasExistingBatches={p.batch_count > 0} />
        </TabsContent>
        <TabsContent value="tests" className="mt-4">
          <ProductTestResultsTab productId={Number(id)} />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <ProductInventoryTab productId={Number(id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
