import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import listFactories from '@/actions/logistics/listFactories';
import createInboundShipment from '@/actions/logistics/createInboundShipment';
import createInboundShipmentItem from '@/actions/logistics/createInboundShipmentItem';
import listProducts from '@/actions/products/listProducts';
import listBatches from '@/actions/batches/listBatches';
import listWarehouses from '@/actions/warehouse/listWarehouses';

type LineItem = {
  key: string;
  product_id: string;
  batch_id: string;
  destination_warehouse_id: string;
  quantity_shipped: string;
  expected_arrival_date: string;
};
type Factory = { id: number; name: string };
type Product = { id: number; sku: string; name: string };
type Batch = { id: number; batch_number: string; product_id: number; qc_status: string };
type Warehouse = { id: number; name: string };

function newLineKey() { return `line-${Date.now()}-${Math.random()}`; }

export type ShipmentPrefillItem = { product_id: number; product_name: string; sku: string; quantity: number };

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  /** Pre-populated lines from the Warehouse Reorder quick-action. */
  prefillItems?: ShipmentPrefillItem[];
}

export function NewShipmentDialog({ open, onClose, onCreated, prefillItems }: Props) {
  const [refNumber, setRefNumber] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [freightForwarder, setFreightForwarder] = useState('');
  const [mode, setMode] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [customsStatus, setCustomsStatus] = useState('');
  const [htsCode, setHtsCode] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>(() =>
    prefillItems && prefillItems.length > 0
      ? prefillItems.map(p => ({
          key: newLineKey(), product_id: String(p.product_id), batch_id: '',
          destination_warehouse_id: '', quantity_shipped: String(p.quantity), expected_arrival_date: '',
        }))
      : [{
          key: newLineKey(), product_id: '', batch_id: '',
          destination_warehouse_id: '', quantity_shipped: '', expected_arrival_date: '',
        }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [factories] = useLoadAction(listFactories, [], {});
  const [products] = useLoadAction(listProducts, [], {});
  const [allBatches] = useLoadAction(listBatches, [], {});
  const [warehouses] = useLoadAction(listWarehouses, [], {});

  const [createShipment] = useMutateAction(createInboundShipment);
  const [createItem] = useMutateAction(createInboundShipmentItem);

  const factoryList = (factories as Factory[]) || [];
  const productList = (products as Product[]) || [];
  const batchList = (allBatches as Batch[]) || [];
  const warehouseList = (warehouses as Warehouse[]) || [];

  const addLine = () => setLines(prev => [...prev, {
    key: newLineKey(), product_id: '', batch_id: '',
    destination_warehouse_id: '', quantity_shipped: '', expected_arrival_date: '',
  }]);

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const updateLine = (key: string, field: keyof LineItem, value: string) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const getBatchesForProduct = (product_id: string) =>
    batchList.filter(b => String(b.product_id) === product_id);

  const handleSubmit = async () => {
    if (!refNumber || !factoryId || !mode) {
      setError('Reference number, factory, and mode are required.');
      return;
    }
    if (lines.some(l => !l.product_id || !l.batch_id || !l.destination_warehouse_id || !l.quantity_shipped)) {
      setError('All line items must have product, batch, warehouse, and quantity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await createShipment({
        reference_number: refNumber, factory_id: Number(factoryId),
        freight_forwarder: freightForwarder || null,
        mode, tracking_number: trackingNumber || null,
        departure_date: departureDate || null, arrival_date: arrivalDate || null,
        customs_status: customsStatus || null, hts_code: htsCode || null,
        declared_value: declaredValue ? Number(declaredValue) : null,
        notes: notes || null,
      });
      const rows = result as { id: number }[];
      const shipmentId = rows[0]?.id;
      if (!shipmentId) throw new Error('Failed to create shipment');

      for (const line of lines) {
        await createItem({
          shipment_id: shipmentId,
          product_id: Number(line.product_id),
          batch_id: Number(line.batch_id),
          destination_warehouse_id: Number(line.destination_warehouse_id),
          quantity_shipped: Number(line.quantity_shipped),
          expected_arrival_date: line.expected_arrival_date || null,
        });
      }
      onCreated(shipmentId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Inbound Shipment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Reference Number *</Label>
              <Input value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="e.g. SHP-2024-001" />
            </div>
            <div>
              <Label>Factory *</Label>
              <Select value={factoryId} onValueChange={setFactoryId}>
                <SelectTrigger><SelectValue placeholder="Select factory" /></SelectTrigger>
                <SelectContent>
                  {factoryList.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mode *</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="ocean">Ocean</SelectItem>
                  <SelectItem value="express_courier">Express Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Freight Forwarder</Label>
              <Input value={freightForwarder} onChange={e => setFreightForwarder(e.target.value)} placeholder="FF company name" />
            </div>
            <div>
              <Label>Tracking Number</Label>
              <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking #" />
            </div>
            <div>
              <Label>Departure Date</Label>
              <Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
            </div>
            <div>
              <Label>Estimated Arrival</Label>
              <Input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
            </div>
            <div>
              <Label>Customs Status</Label>
              <Select value={customsStatus || '_none'} onValueChange={v => setCustomsStatus(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Customs status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>HTS Code</Label>
              <Input value={htsCode} onChange={e => setHtsCode(e.target.value)} placeholder="e.g. 2937.19" />
            </div>
            <div>
              <Label>Declared Value (USD)</Label>
              <Input type="number" value={declaredValue} onChange={e => setDeclaredValue(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes…" />
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLine} className="flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const batchesForProduct = getBatchesForProduct(line.product_id);
                return (
                  <div key={line.key} className="border rounded-lg p-3 bg-gray-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Line {idx + 1}</span>
                      {lines.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.key)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Product *</Label>
                        <Select value={line.product_id} onValueChange={v => {
                          updateLine(line.key, 'product_id', v);
                          updateLine(line.key, 'batch_id', '');
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {productList.map((p: Product) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.sku} — {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Batch *</Label>
                        <Select value={line.batch_id} onValueChange={v => updateLine(line.key, 'batch_id', v)} disabled={!line.product_id}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select batch" /></SelectTrigger>
                          <SelectContent>
                            {batchesForProduct.map((b: Batch) => (
                              <SelectItem key={b.id} value={String(b.id)}>
                                {b.batch_number} ({b.qc_status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Destination Warehouse *</Label>
                        <Select value={line.destination_warehouse_id} onValueChange={v => updateLine(line.key, 'destination_warehouse_id', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                          <SelectContent>
                            {warehouseList.map((w: Warehouse) => (
                              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Quantity Shipped *</Label>
                        <Input
                          type="number" min={1}
                          className="h-8 text-xs"
                          value={line.quantity_shipped}
                          onChange={e => updateLine(line.key, 'quantity_shipped', e.target.value)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Expected Arrival Override</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={line.expected_arrival_date}
                          onChange={e => updateLine(line.key, 'expected_arrival_date', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Shipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
