import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin } from 'lucide-react';
import listWarehouses from '@/actions/settings/listWarehouses';
import createWarehouse from '@/actions/settings/createWarehouse';
import updateWarehouseActive from '@/actions/settings/updateWarehouseActive';

type Warehouse = {
  id: number; name: string; city: string; state: string; country: string;
  address_line1: string; address_line2: string; postal_code: string;
  notes: string; is_active: boolean;
};

export function WarehousesTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [warehouses, , , reload] = useLoadAction(listWarehouses, [], {});
  const [doCreate] = useMutateAction(createWarehouse);
  const [doToggle] = useMutateAction(updateWarehouseActive);

  const list = asRows<Warehouse>(warehouses);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    const dup = list.find(w => w.name.toLowerCase() === name.trim().toLowerCase());
    if (dup) { setError('A warehouse with this name already exists.'); return; }
    setSaving(true); setError('');
    try {
      await doCreate({ name: name.trim(), city: city || null, state: state || null, country: country || null, address_line1: address1 || null, address_line2: address2 || null, postal_code: postal || null, notes: notes || null });
      setShowAdd(false);
      setName(''); setCity(''); setState(''); setCountry('');
      setAddress1(''); setAddress2(''); setPostal(''); setNotes('');
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    await doToggle({ id, is_active: !current });
    reload();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Warehouses</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Warehouse
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State / Country</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-center">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(w => (
              <TableRow key={w.id} className={!w.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium text-sm">{w.name}</TableCell>
                <TableCell className="text-sm">{w.city || '—'}</TableCell>
                <TableCell className="text-sm">{[w.state, w.country].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell className="text-sm text-gray-500">{w.address_line1 || '—'}</TableCell>
                <TableCell className="text-sm text-gray-500 max-w-[160px] truncate">{w.notes || '—'}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={!!w.is_active} onCheckedChange={() => handleToggle(w.id, w.is_active)} />
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No warehouses</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Warehouse</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. West Coast Hub" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Address Line 1</Label><Input value={address1} onChange={e => setAddress1(e.target.value)} /></div>
              <div><Label>Address Line 2</Label><Input value={address2} onChange={e => setAddress2(e.target.value)} /></div>
              <div><Label>City</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
              <div><Label>State</Label><Input value={state} onChange={e => setState(e.target.value)} /></div>
              <div><Label>Postal Code</Label><Input value={postal} onChange={e => setPostal(e.target.value)} /></div>
              <div><Label>Country</Label><Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. US" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
