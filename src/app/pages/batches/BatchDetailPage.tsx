import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import getBatchDetailAction from '@/actions/batches/getBatchDetail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, FlaskConical } from 'lucide-react';
import { BatchTestsPanel } from '@/app/pages/batches/BatchTestsPanel';
import { BatchQcPanel } from '@/app/pages/batches/BatchQcPanel';
import { BatchInventoryPanel } from '@/app/pages/batches/BatchInventoryPanel';
import { BatchLinkedDataPanel } from '@/app/pages/batches/BatchLinkedDataPanel';
import { BatchWriteOffPanel } from '@/app/pages/batches/BatchWriteOffPanel';
import { useAppUser } from '@/app/AppContext';

type Batch = {
  id: number; batch_number: string; product_id: number; product_name: string; sku: string;
  factory_id: number; factory_name: string; manufacture_date: string; quantity_produced: number;
  qty_remaining: number; qty_reserved: number; cost_override: number; standard_cost: number;
  qc_status: string; coa_url: string; overall_purity_pct: number; notes: string;
};

const QC_STATUS_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  quarantine: 'bg-orange-100 text-orange-700',
};

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isWarehouse } = useAppUser();
  const [batch, loading, , reload] = useLoadAction(getBatchDetailAction, [], { id });
  const b: Batch | null = Array.isArray(batch) && batch.length > 0 ? batch[0] : null;

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  if (!b) return <div className="p-6 text-slate-500">Batch not found.</div>;

  const effectiveCost = b.cost_override != null ? Number(b.cost_override) : Number(b.standard_cost);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/batches')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
          <FlaskConical className="h-5 w-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 font-mono">{b.batch_number}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${QC_STATUS_COLORS[b.qc_status] || 'bg-slate-100 text-slate-600'}`}>{b.qc_status}</span>
            {b.coa_url && <a href={b.coa_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-sm"><ExternalLink className="h-3 w-3" />CoA</a>}
          </div>
          <p className="text-sm text-slate-500">
            <button className="text-blue-500 hover:underline" onClick={() => navigate(`/products/${b.product_id}`)}>{b.product_name}</button>
            {' · '}{b.sku} · Factory: {b.factory_name || '—'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-800">{b.qty_remaining} kits</div>
          <div className="text-xs text-slate-400">{b.qty_reserved} reserved · {b.quantity_produced} produced</div>
        </div>
      </div>

      {/* Quick metadata strip (cost is admin-only) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Manufacture Date', val: b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString() : '—' },
          { label: 'Overall Purity', val: b.overall_purity_pct != null ? `${b.overall_purity_pct}%` : '—' },
          ...(isAdmin ? [{ label: 'Effective Cost', val: `$${effectiveCost.toFixed(2)} ${b.cost_override != null ? '(override)' : '(standard)'}` }] : []),
          { label: 'Notes', val: b.notes || '—' },
        ].map(({ label, val }) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5 truncate" title={val}>{val}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tests">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full max-w-2xl justify-start">
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          {(isAdmin || isWarehouse) && <TabsTrigger value="qc">QC Controls</TabsTrigger>}
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="linked">Linked Data</TabsTrigger>
          {(isAdmin || isWarehouse) && <TabsTrigger value="writeoff">Write-off</TabsTrigger>}
        </TabsList>

        <TabsContent value="tests" className="mt-4">
          <BatchTestsPanel batchId={Number(id)} />
        </TabsContent>
        {(isAdmin || isWarehouse) && (
          <TabsContent value="qc" className="mt-4">
            <BatchQcPanel batch={b} onRefresh={reload} />
          </TabsContent>
        )}
        <TabsContent value="inventory" className="mt-4">
          <BatchInventoryPanel batchId={Number(id)} />
        </TabsContent>
        <TabsContent value="linked" className="mt-4">
          <BatchLinkedDataPanel batchId={Number(id)} />
        </TabsContent>
        {(isAdmin || isWarehouse) && (
          <TabsContent value="writeoff" className="mt-4">
            <BatchWriteOffPanel batch={b} onRefresh={reload} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
