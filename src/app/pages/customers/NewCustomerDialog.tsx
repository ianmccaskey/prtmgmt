import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import createCustomer from '@/actions/orders/createCustomer';
import checkDuplicateCustomer from '@/actions/orders/checkDuplicateCustomer';

type CreatedCustomer = { id: number; full_name: string; [key: string]: unknown };

interface NewCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (c: CreatedCustomer) => void;
}

const CHANNELS = ['telegram', 'signal', 'discord', 'whatsapp', 'root', 'other'];

const initForm = {
  full_name: '', email: '', phone: '', preferred_channel: 'telegram', channel_handle: '',
  ship_address_line1: '', ship_address_line2: '', ship_city: '', ship_state: '',
  ship_postal_code: '', ship_country: 'US', is_vip: false, notes: '', internal_notes: '',
};

export function NewCustomerDialog({ open, onClose, onCreated }: NewCustomerDialogProps) {
  const [form, setForm] = useState(initForm);
  const [dupOpen, setDupOpen] = useState(false);
  const [dups, setDups] = useState<CreatedCustomer[]>([]);
  const [error, setError] = useState('');
  const [checkDup, checking] = useMutateAction(checkDuplicateCustomer);
  const [doCreate, creating] = useMutateAction(createCustomer);

  const sf = (k: keyof typeof initForm) => (v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const reset = () => { setForm(initForm); setError(''); };

  const submit = async (force = false) => {
    if (!form.full_name.trim()) { setError('Name is required'); return; }
    setError('');
    if (!force) {
      const found = await checkDup({ fullName: form.full_name, shipAddressLine1: form.ship_address_line1 }) as CreatedCustomer[];
      if (found?.length > 0) { setDups(found); setDupOpen(true); return; }
    }
    const res = await doCreate({
      fullName: form.full_name, email: form.email || null, phone: form.phone || null,
      preferredChannel: form.preferred_channel, channelHandle: form.channel_handle || null,
      shipAddressLine1: form.ship_address_line1 || null, shipAddressLine2: form.ship_address_line2 || null,
      shipCity: form.ship_city || null, shipState: form.ship_state || null,
      shipPostalCode: form.ship_postal_code || null, shipCountry: form.ship_country || 'US',
      isVip: form.is_vip, notes: form.notes || null, internalNotes: form.internal_notes || null,
    }) as CreatedCustomer[];
    if (res?.[0]) { onCreated({ ...form, id: res[0].id }); reset(); }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => sf('full_name')(e.target.value)} />
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => sf('email')(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => sf('phone')(e.target.value)} /></div>
            <div>
              <Label>Channel</Label>
              <Select value={form.preferred_channel} onValueChange={sf('preferred_channel')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Handle</Label><Input value={form.channel_handle} onChange={e => sf('channel_handle')(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address Line 1</Label><Input value={form.ship_address_line1} onChange={e => sf('ship_address_line1')(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address Line 2</Label><Input value={form.ship_address_line2} onChange={e => sf('ship_address_line2')(e.target.value)} /></div>
            <div><Label>City</Label><Input value={form.ship_city} onChange={e => sf('ship_city')(e.target.value)} /></div>
            <div><Label>State</Label><Input value={form.ship_state} onChange={e => sf('ship_state')(e.target.value)} /></div>
            <div><Label>Postal Code</Label><Input value={form.ship_postal_code} onChange={e => sf('ship_postal_code')(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={form.ship_country} onChange={e => sf('ship_country')(e.target.value)} /></div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => sf('notes')(e.target.value)} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Internal Notes</Label>
              <Textarea value={form.internal_notes} onChange={e => sf('internal_notes')(e.target.value)} rows={2} />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="vip-check" checked={form.is_vip} onChange={e => sf('is_vip')(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="vip-check">Mark as VIP</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => submit(false)} disabled={creating || checking}>Create Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate warning */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Possible Duplicate Detected</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Found customers with matching name and address:</p>
          <div className="space-y-2 mb-3">
            {dups.map(d => (
              <div key={d.id} className="border rounded p-3 text-sm space-y-1">
                <p className="font-medium">{d.full_name as string}</p>
                <p className="text-xs text-muted-foreground">
                  {d.email as string} · {d.ship_address_line1 as string}, {d.ship_city as string}
                </p>
                {d.last_order_date ? <p className="text-xs text-muted-foreground">Last order: {new Date(d.last_order_date as string).toLocaleDateString()}</p> : null}
                <Button size="sm" variant="outline" className="mt-1" onClick={() => { onCreated(d); setDupOpen(false); handleClose(); }}>
                  Use This Customer
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>Cancel</Button>
            <Button onClick={() => { setDupOpen(false); submit(true); }}>Create Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
