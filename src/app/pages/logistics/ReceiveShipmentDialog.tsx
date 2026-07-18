import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import receiveLineAtomic from '@/actions/logistics/receiveLineAtomic';
import flipShipmentDelivered from '@/actions/logistics/flipShipmentDelivered';

type ShipmentItem = {
  id: number; shipment_id: number; product_id: number; batch_id: number;
  destination_warehouse_id: number; quantity_shipped: number;
  sku: string; product_name: string; batch_number: string;
  destination_warehouse_name: string;
};

type LineReceiveState = {
  quantity_received: string;
  condition_flag: string;
  discrepancy_notes: string;
  auto_writeoff: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  shipmentId: number;
  items: ShipmentItem[];
  onDone: () => void;
}

export function ReceiveShipmentDialog({ open, onClose, shipmentId, items, onDone }: Props) {
  const { profileId } = useAppUser();
  const [lineStates, setLineStates] = useState<Record<number, LineReceiveState>>(() => {
    const init: Record<number, LineReceiveState> = {};
    for (const item of items) {
      init[item.id] = {
        quantity_received: String(item.quantity_shipped),
        condition_flag: 'ok',
        discrepancy_notes: '',
        auto_writeoff: true,
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'fill' | 'confirm'>('fill');

  const [doReceiveLine] = useMutateAction(receiveLineAtomic);
  const [doFlipDelivered] = useMutateAction(flipShipmentDelivered);

  const updateLine = (itemId: number, field: keyof LineReceiveState, value: string | boolean) =>
    setLineStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));

  const hasDiscrepancy = (item: ShipmentItem) => {
    const s = lineStates[item.id];
    if (!s) return false;
    return Number(s.quantity_received) < item.quantity_shipped || s.condition_flag !== 'ok';
  };

  const discrepancyItems = items.filter(item => hasDiscrepancy(item));
  const missingNotes = discrepancyItems.filter(item => !lineStates[item.id]?.discrepancy_notes);

  const handleConfirm = async () => {
    if (missingNotes.length > 0) {
      setError('Discrepancy notes are required for all flagged lines.');
      return;
    }
    setSaving(true);
    setError('');
    const alreadyReceived: string[] = [];
    try {
      for (const item of items) {
        const s = lineStates[item.id];
        const qtyReceived = Math.max(0, Number(s.quantity_received));

        // One atomic statement per line: guarded receive + inventory credit
        // + shortage write-off + activity log. Zero rows = someone else
        // received it meanwhile — skip, no side effects fired.
        const updated = await doReceiveLine({
          item_id: item.id,
          quantity_received: qtyReceived,
          condition_flag: s.condition_flag,
          discrepancy_notes: s.discrepancy_notes || null,
          auto_writeoff: s.auto_writeoff,
          user_id: profileId,
        }) as unknown[];
        if (!updated || updated.length === 0) {
          alreadyReceived.push(item.product_name);
        }
      }

      // Flip shipment status
      await doFlipDelivered({ shipment_id: shipmentId });

      if (alreadyReceived.length > 0) {
        setError(`Already received by someone else (no double credit): ${alreadyReceived.join(', ')}. Everything else was processed.`);
        setSaving(false);
        return;
      }
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process receipt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Shipment — {items.length} Line{items.length !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        {step === 'fill' ? (
          <div className="space-y-4">
            {items.map(item => {
              const s = lineStates[item.id];
              const isDiscrep = hasDiscrepancy(item);
              return (
                <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${isDiscrep ? 'border-amber-300 bg-amber-50' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{item.product_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.sku} · Batch {item.batch_number}</div>
                      <div className="text-xs text-gray-500">→ {item.destination_warehouse_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Shipped</div>
                      <div className="text-lg font-bold">{item.quantity_shipped}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Qty Received *</Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.quantity_shipped}
                        className="h-8 text-sm"
                        value={s?.quantity_received ?? item.quantity_shipped}
                        onChange={e => updateLine(item.id, 'quantity_received', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Condition *</Label>
                      <Select value={s?.condition_flag || 'ok'} onValueChange={v => updateLine(item.id, 'condition_flag', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ok">OK</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isDiscrep && (
                    <div className="space-y-2 border-t border-amber-200 pt-2">
                      <div className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {Number(s.quantity_received) < item.quantity_shipped
                          ? `Short ${item.quantity_shipped - Number(s.quantity_received)} units`
                          : ''
                        }
                        {s.condition_flag !== 'ok' ? ` · Condition: ${s.condition_flag}` : ''}
                      </div>
                      <div>
                        <Label className="text-xs">Discrepancy Notes *</Label>
                        <Textarea
                          className="text-sm"
                          rows={2}
                          value={s.discrepancy_notes}
                          onChange={e => updateLine(item.id, 'discrepancy_notes', e.target.value)}
                          placeholder="Describe the discrepancy…"
                        />
                      </div>
                      {Number(s.quantity_received) < item.quantity_shipped && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={s.auto_writeoff}
                            onCheckedChange={v => updateLine(item.id, 'auto_writeoff', v)}
                          />
                          <Label className="text-xs cursor-pointer">
                            Auto write-off {item.quantity_shipped - Number(s.quantity_received)} short units
                          </Label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {discrepancyItems.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {discrepancyItems.length} line{discrepancyItems.length > 1 ? 's' : ''} with discrepancies
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-sm text-blue-800 mb-2">Confirm Receipt Actions</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                {items.map(item => {
                  const s = lineStates[item.id];
                  const qtyReceived = Number(s.quantity_received);
                  const isDiscrep = hasDiscrepancy(item);
                  const shortQty = item.quantity_shipped - qtyReceived;
                  return (
                    <li key={item.id} className="flex items-start gap-2">
                      {isDiscrep
                        ? <AlertTriangle className="h-3 w-3 mt-1 text-amber-500 flex-shrink-0" />
                        : <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                      }
                      <span>
                        <strong>{item.product_name}</strong>: receive {qtyReceived} of {item.quantity_shipped}
                        {isDiscrep && s.auto_writeoff && shortQty > 0 && ` + write off ${shortQty}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {step === 'fill' ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => { setError(''); setStep('confirm'); }}>
                Review & Confirm
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('fill')} disabled={saving}>Back</Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? 'Processing…' : 'Confirm Receipt'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
