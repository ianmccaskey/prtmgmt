import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import listBatchesAction from '@/actions/batches/listBatches';
import listFactoriesAction from '@/actions/products/listFactories';
import listProductsAction from '@/actions/products/listProducts';
import { usePagination, PaginationFooter } from '@/components/Paginated';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink } from 'lucide-react';

type Batch = {
  id: number; batch_number: string; product_id: number; sku: string; product_name: string;
  factory_name: string; manufacture_date: string; quantity_produced: number;
  qty_remaining: number; qc_status: string; overall_purity_pct: number; coa_url: string;
};

const QC_STATUS_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  quarantine: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function BatchesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [qcStatus, setQcStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [batches, loading] = useLoadAction(listBatchesAction, [], { search, product_id: productId, factory_id: factoryId, qc_status: qcStatus, date_from: dateFrom || null, date_to: dateTo || null });
  const [factories] = useLoadAction(listFactoriesAction, [], {});
  const [products] = useLoadAction(listProductsAction, [], {});

  const rows: Batch[] = asRows(batches);
  const pgBatch = usePagination(rows);
  const factoryList: { id: number; name: string }[] = asRows(factories);
  const productList: { id: number; name: string; sku: string }[] = asRows(products);

  const statCounts = {
    passed: rows.filter(r => r.qc_status === 'passed').length,
    pending: rows.filter(r => r.qc_status === 'pending').length,
    quarantine: rows.filter(r => r.qc_status === 'quarantine').length,
    failed: rows.filter(r => r.qc_status === 'failed').length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Batches</h1>
          <p className="text-sm text-slate-500">{rows.length} batches</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">{statCounts.passed} Passed</span>
          <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">{statCounts.pending} Pending</span>
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">{statCounts.quarantine} Quarantined</span>
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">{statCounts.failed} Failed</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search batch #, product…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All products</SelectItem>
                {productList.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.sku} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={factoryId} onValueChange={setFactoryId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All factories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All factories</SelectItem>
                {factoryList.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={qcStatus} onValueChange={setQcStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All QC status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="quarantine">Quarantined</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" placeholder="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            <Input type="date" placeholder="To" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Batch #</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Factory</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Mfg Date</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Produced</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Remaining</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">QC Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Purity %</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">CoA</th>
                  </tr>
                </thead>
                <tbody>
                  {pgBatch.pageRows.map(b => (
                    <tr key={b.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/batches/${b.id}`)}>
                      <td className="px-4 py-3 font-mono font-medium text-blue-600">{b.batch_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{b.product_name}</div>
                        <div className="text-xs text-slate-400">{b.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.factory_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">{b.quantity_produced}</td>
                      <td className="px-4 py-3 text-right">{b.qty_remaining}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${QC_STATUS_COLORS[b.qc_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{b.qc_status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{b.overall_purity_pct != null ? `${b.overall_purity_pct}%` : '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {b.coa_url ? <a href={b.coa_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline"><ExternalLink className="h-3 w-3" /></a> : '—'}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No batches found</td></tr>}
                </tbody>
              </table>
            )}
            <PaginationFooter {...pgBatch} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
