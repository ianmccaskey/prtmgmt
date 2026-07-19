import React from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import listBatchTestsAction from '@/actions/batches/listBatchTests';
import getBatchInventoryAction from '@/actions/batches/getBatchInventory';
import getBatchOrdersAction from '@/actions/batches/getBatchOrders';
import getBatchWriteoffsAction from '@/actions/batches/getBatchWriteoffs';
import getBatchInboundShipmentsAction from '@/actions/batches/getBatchInboundShipments';
import getBatchTransfersAction from '@/actions/batches/getBatchTransfers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';

type Row = Record<string, string | number | boolean | null>;

type Batch = {
  id: number; batch_number: string; product_name: string; sku: string;
  factory_name: string; manufacture_date: string; quantity_produced: number;
  net_content_mg: number | null;
  qty_remaining: number; qc_status: string; overall_purity_pct: number;
  coa_url: string; notes: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-xs text-slate-500 italic">None recorded.</p>;
  return (
    <div className="overflow-x-auto print:overflow-visible"><table className="w-full text-xs border-collapse">
      <thead>
        <tr>{headers.map(h => <th key={h} className="text-left border-b border-slate-200 py-1 pr-3 font-semibold">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-slate-100 py-1 pr-3">{c}</td>)}</tr>
        ))}
      </tbody>
    </table></div>
  );
}

/**
 * The prompt's sole allowed PDF output: a printable traceability summary
 * (browser print → Save as PDF). Rendered inside a `.print-area` so print CSS
 * isolates it from the rest of the app.
 */
export function BatchTraceabilityReport({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const batchId = batch.id;
  const [tests] = useLoadAction(listBatchTestsAction, [batchId], { batch_id: batchId, test_type: '' });
  const [inventory] = useLoadAction(getBatchInventoryAction, [batchId], { batch_id: batchId });
  const [orders] = useLoadAction(getBatchOrdersAction, [batchId], { batch_id: batchId });
  const [writeoffs] = useLoadAction(getBatchWriteoffsAction, [batchId], { batch_id: batchId });
  const [inbound] = useLoadAction(getBatchInboundShipmentsAction, [batchId], { batch_id: batchId });
  const [transfers] = useLoadAction(getBatchTransfersAction, [batchId], { batch_id: batchId });

  const testRows = asRows<Row>(tests);
  const invRows = asRows<Row>(inventory);
  const orderRows = asRows<Row>(orders);
  const woRows = asRows<Row>(writeoffs);
  const inboundRows = asRows<Row>(inbound);
  const transferRows = asRows<Row>(transfers);

  const fmtDate = (v: string | number | boolean | null) => (v ? new Date(String(v)).toLocaleDateString() : '—');

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print-dialog">
        <div className="flex items-center justify-between mb-2 print-hidden">
          <Button size="sm" onClick={() => window.print()}><Printer className="h-3 w-3 mr-1" /> Print / Save as PDF</Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="print-area bg-white text-slate-900 p-2">
          <div className="mb-4">
            <h1 className="text-xl font-bold">Batch Traceability Report</h1>
            <p className="text-sm text-slate-600">
              {batch.product_name} ({batch.sku}) · Batch <span className="font-mono font-semibold">{batch.batch_number}</span>
            </p>
            <p className="text-xs text-slate-500">Generated {new Date().toLocaleString()}</p>
          </div>

          <Section title="Batch Metadata">
            <SimpleTable
              headers={['Factory', 'Mfg Date', 'Produced', 'Net (mg)', 'Remaining', 'QC Status', 'Purity %', 'CoA']}
              rows={[[
                batch.factory_name || '—', fmtDate(batch.manufacture_date),
                batch.quantity_produced,
                batch.net_content_mg != null ? Number(batch.net_content_mg) : '—',
                batch.qty_remaining, batch.qc_status,
                batch.overall_purity_pct != null ? `${batch.overall_purity_pct}%` : '—',
                batch.coa_url || '—',
              ]]}
            />
            {batch.notes && <p className="text-xs text-slate-600 mt-1">Notes: {batch.notes}</p>}
          </Section>

          <Section title="Source Inbound Shipments">
            <SimpleTable
              headers={['Reference', 'Factory', 'Destination', 'Shipped', 'Received', 'Condition']}
              rows={inboundRows.map(r => [
                String(r.reference_number || '—'), String(r.factory_name || '—'), String(r.destination_warehouse || '—'),
                Number(r.quantity_shipped || 0), r.quantity_received != null ? Number(r.quantity_received) : '—',
                String(r.condition_flag || '—'),
              ])}
            />
          </Section>

          <Section title="Test Results">
            <SimpleTable
              headers={['Type', 'Date', 'Lab', 'Result', 'Spec', 'Pass/Fail']}
              rows={testRows.map(r => [
                String(r.test_type), fmtDate(r.test_date), String(r.lab_name || '—'),
                `${r.result_value ?? '—'} ${r.result_units ?? ''}`,
                `${r.spec_min ?? '—'} – ${r.spec_max ?? '—'}`,
                String(r.pass_fail || '—'),
              ])}
            />
          </Section>

          <Section title="Current Inventory by Warehouse">
            <SimpleTable
              headers={['Warehouse', 'On Hand', 'Reserved', 'Available']}
              rows={invRows.map(r => [
                String(r.warehouse_name), Number(r.quantity_on_hand || 0),
                Number(r.quantity_reserved || 0),
                Number(r.quantity_on_hand || 0) - Number(r.quantity_reserved || 0),
              ])}
            />
          </Section>

          <Section title="Sales Order Lines Consuming This Batch">
            <SimpleTable
              headers={['Order #', 'Customer', 'Order Date', 'Qty Allocated', 'Status']}
              rows={orderRows.map(r => [
                String(r.order_number || '—'), String(r.customer_name || '—'),
                fmtDate(r.order_date), Number(r.qty_allocated || 0), String(r.status || '—'),
              ])}
            />
          </Section>

          <Section title="Write-offs">
            <SimpleTable
              headers={['Date', 'Warehouse', 'Qty', 'Reason', 'Notes']}
              rows={woRows.map(r => [
                fmtDate(r.created_at), String(r.warehouse_name || '—'),
                Number(r.quantity || 0), String(r.reason || '—'), String(r.notes || '—'),
              ])}
            />
          </Section>

          <Section title="Inter-Warehouse Transfers">
            <SimpleTable
              headers={['Initiated', 'From', 'To', 'Qty', 'Status']}
              rows={transferRows.map(r => [
                fmtDate(r.initiated_at), String(r.source_warehouse_name || '—'),
                String(r.destination_warehouse_name || '—'), Number(r.quantity || 0), String(r.status || '—'),
              ])}
            />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
