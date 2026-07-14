import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Package, Plane, Ship, AlertTriangle, CheckCircle2,
  FileText, Plus, ExternalLink, Truck
} from 'lucide-react';
import getShipmentDetail from '@/actions/logistics/getShipmentDetail';
import listShipmentItems from '@/actions/logistics/listShipmentItems';
import listShipmentDocuments from '@/actions/logistics/listShipmentDocuments';
import createShipmentDocument from '@/actions/logistics/createShipmentDocument';
import updateShipmentStatus from '@/actions/logistics/updateShipmentStatus';
import { ReceiveShipmentDialog } from './ReceiveShipmentDialog';

type Shipment = {
  id: number; reference_number: string; factory_name: string; factory_id: number;
  freight_forwarder: string; mode: string; tracking_number: string;
  departure_date: string; arrival_date: string; status: string;
  customs_status: string; hts_code: string; declared_value: number; notes: string;
};
type ShipmentItem = {
  id: number; shipment_id: number; product_id: number; batch_id: number;
  destination_warehouse_id: number; quantity_shipped: number; quantity_received: number | null;
  condition_flag: string | null; discrepancy_notes: string | null; evidence_url: string | null;
  expected_arrival_date: string | null; received_at: string | null;
  sku: string; product_name: string; batch_number: string; qc_status: string;
  destination_warehouse_name: string;
};
type Doc = {
  id: number; doc_type: string; label: string; doc_url: string;
  created_at: string; created_by_name: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  with_freight_forwarder: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const CONDITION_COLORS: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  damaged: 'bg-red-100 text-red-700',
  short: 'bg-amber-100 text-amber-700',
  mixed: 'bg-purple-100 text-purple-700',
};
const ALL_STATUSES = ['pending', 'with_freight_forwarder', 'in_transit', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', with_freight_forwarder: 'With Freight Forwarder',
  in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled',
};

function ModeIcon({ mode }: { mode: string }) {
  if (mode === 'air') return <Plane className="h-4 w-4" />;
  if (mode === 'ocean') return <Ship className="h-4 w-4" />;
  return <Truck className="h-4 w-4" />;
}

export function ShipmentDetailPage() {
  const { profileId } = useAppUser();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [docType, setDocType] = useState('');
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const [shipment, shipLoading, , reloadShipment] = useLoadAction(getShipmentDetail, [], { id });
  const [items, itemsLoading, , reloadItems] = useLoadAction(listShipmentItems, [], { shipment_id: id });
  const [docs, , , reloadDocs] = useLoadAction(listShipmentDocuments, [], { shipment_id: id });

  const [createDoc] = useMutateAction(createShipmentDocument);
  const [updateStatus] = useMutateAction(updateShipmentStatus);

  const detail = (shipment as Shipment[])?.[0];
  const itemList = (items as ShipmentItem[]) || [];
  const docList = (docs as Doc[]) || [];

  const handleAddDoc = async () => {
    if (!docType || !docUrl) return;
    setSavingDoc(true);
    try {
      await createDoc({ shipment_id: Number(id), doc_type: docType, label: docLabel || docType, doc_url: docUrl, user_id: profileId });
      setShowAddDoc(false);
      setDocType(''); setDocLabel(''); setDocUrl('');
      reloadDocs();
    } finally {
      setSavingDoc(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusChanging(true);
    try {
      await updateStatus({ id: Number(id), status: newStatus });
      reloadShipment();
    } finally {
      setStatusChanging(false);
    }
  };

  const unreceived = itemList.filter(item => item.quantity_received === null || item.quantity_received === undefined);

  if (shipLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!detail) return <div className="p-8 text-gray-400">Shipment not found.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/logistics')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{detail.reference_number}</h1>
              <Badge className={STATUS_COLORS[detail.status] || 'bg-gray-100 text-gray-700'}>
                {STATUS_LABELS[detail.status] || detail.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              {detail.factory_name} · {detail.mode?.replace('_', ' ')} via {detail.freight_forwarder || 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail.status !== 'delivered' && detail.status !== 'cancelled' && unreceived.length > 0 && (
            <Button onClick={() => setShowReceive(true)} className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Receive Shipment
            </Button>
          )}
          <Select value={detail.status} onValueChange={handleStatusChange} disabled={statusChanging}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Shipment Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Factory</dt>
              <dd className="font-medium">{detail.factory_name || '—'}</dd>
              <dt className="text-gray-500">Mode</dt>
              <dd className="flex items-center gap-1">
                <ModeIcon mode={detail.mode} />
                <span className="capitalize">{detail.mode?.replace('_', ' ')}</span>
              </dd>
              <dt className="text-gray-500">Freight Forwarder</dt>
              <dd>{detail.freight_forwarder || '—'}</dd>
              <dt className="text-gray-500">Tracking</dt>
              <dd className="font-mono text-xs">{detail.tracking_number || '—'}</dd>
              <dt className="text-gray-500">Departure</dt>
              <dd>{detail.departure_date ? detail.departure_date.split('T')[0] : '—'}</dd>
              <dt className="text-gray-500">Arrival</dt>
              <dd>{detail.arrival_date ? detail.arrival_date.split('T')[0] : '—'}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Customs & Value</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Customs Status</dt>
              <dd>{detail.customs_status ? <Badge variant="outline">{detail.customs_status}</Badge> : '—'}</dd>
              <dt className="text-gray-500">HTS Code</dt>
              <dd className="font-mono">{detail.hts_code || '—'}</dd>
              <dt className="text-gray-500">Declared Value</dt>
              <dd>{detail.declared_value ? `$${Number(detail.declared_value).toLocaleString()}` : '—'}</dd>
              <dt className="text-gray-500 col-span-2">Notes</dt>
              <dd className="col-span-2 text-gray-700">{detail.notes || '—'}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Line Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Shipped</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Discrepancy Notes</TableHead>
                <TableHead>Expected Arrival</TableHead>
                <TableHead>Received At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-gray-400">Loading…</TableCell></TableRow>
              ) : itemList.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-gray-400">No line items</TableCell></TableRow>
              ) : itemList.map(item => (
                <TableRow key={item.id} className={item.condition_flag && item.condition_flag !== 'ok' ? 'bg-red-50' : ''}>
                  <TableCell>
                    <div className="font-medium text-sm">{item.product_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-mono">{item.batch_number}</div>
                    <Badge variant="outline" className="text-xs">{item.qc_status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.destination_warehouse_name}</TableCell>
                  <TableCell className="text-right font-medium">{item.quantity_shipped}</TableCell>
                  <TableCell className="text-right">
                    {item.quantity_received !== null && item.quantity_received !== undefined ? (
                      <span className={item.quantity_received < item.quantity_shipped ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {item.quantity_received}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not received</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.condition_flag ? (
                      <Badge className={CONDITION_COLORS[item.condition_flag] || 'bg-gray-100 text-gray-700'}>
                        {item.condition_flag}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[180px] truncate">
                    {item.discrepancy_notes || '—'}
                  </TableCell>
                  <TableCell className="text-sm">{item.expected_arrival_date ? item.expected_arrival_date.split('T')[0] : '—'}</TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {item.received_at ? new Date(item.received_at).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddDoc(true)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {docList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No documents attached</p>
          ) : (
            <div className="space-y-2">
              {docList.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>
                      <span className="text-sm font-medium">{doc.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Added by {doc.created_by_name || 'Unknown'} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {doc.doc_url && (
                    <a href={doc.doc_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Document Dialog */}
      <Dialog open={showAddDoc} onOpenChange={v => !v && setShowAddDoc(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Document Type *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="packing_list">Packing List</SelectItem>
                  <SelectItem value="bill_of_lading">Bill of Lading</SelectItem>
                  <SelectItem value="coa">CoA (Certificate of Analysis)</SelectItem>
                  <SelectItem value="customs_declaration">Customs Declaration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder="Document label" />
            </div>
            <div>
              <Label>Document URL *</Label>
              <Input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDoc(false)}>Cancel</Button>
            <Button onClick={handleAddDoc} disabled={savingDoc || !docType || !docUrl}>
              {savingDoc ? 'Saving…' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Shipment Dialog */}
      {showReceive && (
        <ReceiveShipmentDialog
          open={showReceive}
          onClose={() => setShowReceive(false)}
          shipmentId={Number(id)}
          items={unreceived}
          onDone={() => {
            setShowReceive(false);
            reloadShipment();
            reloadItems();
          }}
        />
      )}
    </div>
  );
}
