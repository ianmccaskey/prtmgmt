import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
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
import { Plus, MapPin, ChevronDown, ChevronRight, Home, Tag } from 'lucide-react';
import listWarehouses from '@/actions/settings/listWarehouses';
import createWarehouse from '@/actions/settings/createWarehouse';
import updateWarehouseActive from '@/actions/settings/updateWarehouseActive';
import updateWarehouseShippo from '@/actions/settings/updateWarehouseShippo';
import listReceiveAddresses from '@/actions/warehouse/listReceiveAddresses';
import createReceiveAddress from '@/actions/warehouse/createReceiveAddress';
import setReceiveAddressActive from '@/actions/warehouse/setReceiveAddressActive';

type Warehouse = {
  id: number; name: string; ship_from_name: string | null; city: string; state: string; country: string;
  address_line1: string; address_line2: string; postal_code: string;
  notes: string; is_active: boolean;
  ship_from_phone: string | null; has_shippo_key: boolean;
};
type ReceiveAddress = {
  id: number; warehouse_id: number; label: string; address_name: string | null;
  address_line1: string; address_line2: string; city: string; state: string;
  postal_code: string; country: string; is_active: boolean; notes: string;
};

export function WarehousesTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [shipFromName, setShipFromName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Receive addresses (multiple per warehouse; ship-from stays on the warehouse row)
  const [expandedWh, setExpandedWh] = useState<number | null>(null);
  const [addAddrFor, setAddAddrFor] = useState<Warehouse | null>(null);
  const emptyAddr = { label: '', address_name: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'US', notes: '' };
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState('');

  // Shippo config per warehouse (API key is write-only: we only read whether one exists)
  const [shippoFor, setShippoFor] = useState<Warehouse | null>(null);
  const [shippoKey, setShippoKey] = useState('');
  const [shippoPhone, setShippoPhone] = useState('');
  const [shippoSaving, setShippoSaving] = useState(false);
  const [shippoError, setShippoError] = useState('');

  const [warehouses, , , reload] = useLoadAction(listWarehouses, [], {});
  const [addresses, , , reloadAddresses] = useLoadAction(listReceiveAddresses, [], {});
  const [doCreate] = useMutateAction(createWarehouse);
  const [doToggle] = useMutateAction(updateWarehouseActive);
  const [doShippo] = useMutateAction(updateWarehouseShippo);
  const [doCreateAddr] = useMutateAction(createReceiveAddress);
  const [doToggleAddr] = useMutateAction(setReceiveAddressActive);

  const list = asRows<Warehouse>(warehouses);
  const addrList = asRows<ReceiveAddress>(addresses);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    const dup = list.find(w => w.name.toLowerCase() === name.trim().toLowerCase());
    if (dup) { setError('A warehouse with this name already exists.'); return; }
    setSaving(true); setError('');
    try {
      await doCreate({ name: name.trim(), ship_from_name: shipFromName.trim() || null, city: city || null, state: state || null, country: country || null, address_line1: address1 || null, address_line2: address2 || null, postal_code: postal || null, notes: notes || null });
      setShowAdd(false);
      setName(''); setShipFromName(''); setCity(''); setState(''); setCountry('');
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

  const handleAddAddress = async () => {
    if (!addAddrFor) return;
    if (!addrForm.label.trim() || !addrForm.address_line1.trim()) {
      setAddrError('Label and address line 1 are required.');
      return;
    }
    setAddrSaving(true); setAddrError('');
    try {
      await doCreateAddr({
        warehouse_id: addAddrFor.id,
        label: addrForm.label.trim(),
        address_name: addrForm.address_name.trim() || null,
        address_line1: addrForm.address_line1.trim(),
        address_line2: addrForm.address_line2 || null,
        city: addrForm.city || null,
        state: addrForm.state || null,
        postal_code: addrForm.postal_code || null,
        country: addrForm.country || 'US',
        notes: addrForm.notes || null,
      });
      setAddAddrFor(null);
      setAddrForm(emptyAddr);
      reloadAddresses();
    } catch (e: unknown) {
      setAddrError(e instanceof Error ? e.message : 'Failed to add receive address');
    } finally {
      setAddrSaving(false);
    }
  };

  const handleToggleAddr = async (id: number, current: boolean) => {
    await doToggleAddr({ id, is_active: !current });
    reloadAddresses();
  };

  const openShippo = (w: Warehouse) => {
    setShippoFor(w);
    setShippoKey('');
    setShippoPhone(w.ship_from_phone || '');
    setShippoError('');
  };

  // api_key: null = keep current, '' = remove, else replace.
  const saveShippo = async (removeKey = false) => {
    if (!shippoFor) return;
    setShippoSaving(true); setShippoError('');
    try {
      await doShippo({
        id: shippoFor.id,
        api_key: removeKey ? '' : (shippoKey.trim() || null),
        ship_from_phone: shippoPhone.trim() || null,
      });
      setShippoFor(null);
      reload();
    } catch (e: unknown) {
      setShippoError(e instanceof Error ? e.message : 'Failed to save Shippo settings');
    } finally {
      setShippoSaving(false);
    }
  };

  const fmtAddr = (a: { address_line1: string; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null }, nameLine?: string | null) =>
    [nameLine, a.address_line1, a.address_line2, a.city, a.state, dbText(a.postal_code)].filter(Boolean).join(', ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Warehouses</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Warehouse
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Each warehouse has one ship-from address; expand a row to manage its receive addresses
          (inbound shipments from China can be distributed across them).
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Ship-From Address</TableHead>
              <TableHead className="text-center">Receive Addrs</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-center">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(w => {
              const whAddrs = addrList.filter(a => a.warehouse_id === w.id);
              const expanded = expandedWh === w.id;
              return (
                <React.Fragment key={w.id}>
                  <TableRow className={!w.is_active ? 'opacity-50' : ''}>
                    <TableCell className="cursor-pointer" onClick={() => setExpandedWh(expanded ? null : w.id)}>
                      {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </TableCell>
                    <TableCell className="font-medium text-sm cursor-pointer" onClick={() => setExpandedWh(expanded ? null : w.id)}>{w.name}</TableCell>
                    <TableCell className="text-sm">{w.city || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{w.address_line1 || '—'}</TableCell>
                    <TableCell className="text-center text-sm">
                      <Badge variant="outline" className="text-xs">{whAddrs.filter(a => a.is_active).length}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[160px] truncate">{w.notes || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!w.is_active} onCheckedChange={() => handleToggle(w.id, w.is_active)} />
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-slate-50 p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Home className="h-3 w-3" />
                            <span className="font-medium">Ship-From:</span>
                            <span>{fmtAddr(w, w.ship_from_name) || 'No address set'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Tag className="h-3 w-3" />
                            <span className="font-medium">Shippo:</span>
                            {w.has_shippo_key
                              ? <Badge variant="outline" className="text-xs text-green-600 border-green-300">API key configured</Badge>
                              : <span className="text-gray-400">no API key — labels entered manually</span>}
                            {w.ship_from_phone && <span className="text-gray-400">· phone {w.ship_from_phone}</span>}
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" onClick={() => openShippo(w)}>
                              {w.has_shippo_key ? 'Update' : 'Configure'}
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Receive Addresses</p>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddAddrFor(w); setAddrForm(emptyAddr); setAddrError(''); }}>
                              <Plus className="h-3 w-3 mr-1" /> Add Receive Address
                            </Button>
                          </div>
                          {whAddrs.length === 0 ? (
                            <p className="text-xs text-gray-400">None yet — inbound lines default to the ship-from address.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="py-1 pr-3 font-medium">Label</th>
                                  <th className="py-1 pr-3 font-medium">Address</th>
                                  <th className="py-1 pr-3 font-medium">Notes</th>
                                  <th className="py-1 font-medium text-center">Active</th>
                                </tr>
                              </thead>
                              <tbody>
                                {whAddrs.map(a => (
                                  <tr key={a.id} className={`border-t ${!a.is_active ? 'opacity-50' : ''}`}>
                                    <td className="py-1.5 pr-3 font-medium">{a.label}</td>
                                    <td className="py-1.5 pr-3 text-gray-600">{fmtAddr(a, a.address_name)}</td>
                                    <td className="py-1.5 pr-3 text-gray-500">{a.notes || '—'}</td>
                                    <td className="py-1.5 text-center">
                                      <Switch checked={!!a.is_active} onCheckedChange={() => handleToggleAddr(a.id, a.is_active)} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No warehouses</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Add Warehouse Dialog */}
      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Warehouse</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. West Coast Hub" /></div>
            <p className="text-xs text-gray-400">This address is the warehouse's SHIP-FROM address. Add receive addresses after creating.</p>
            <div><Label>Ship-From Name Line</Label><Input value={shipFromName} onChange={e => setShipFromName(e.target.value)} placeholder='e.g. "SND Fulfillment" — appears as the first address line' /></div>
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

      {/* Shippo Config Dialog */}
      <Dialog open={!!shippoFor} onOpenChange={v => !v && setShippoFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Shippo — {shippoFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              With an API key set, this warehouse can quote rates and buy shipping labels directly in
              the Mark Shipped dialog, billed to its own Shippo account. Find the key under
              Shippo → Settings → API.
            </p>
            <div>
              <Label>API Key {shippoFor?.has_shippo_key && <span className="text-gray-400 font-normal">(leave blank to keep the current key)</span>}</Label>
              <Input
                type="password" value={shippoKey} onChange={e => setShippoKey(e.target.value)}
                placeholder={shippoFor?.has_shippo_key ? '••••••••••••' : 'shippo_live_…'}
              />
            </div>
            <div>
              <Label>Ship-From Phone <span className="text-gray-400 font-normal">(some carriers require one)</span></Label>
              <Input value={shippoPhone} onChange={e => setShippoPhone(e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            {shippoError && <p className="text-sm text-red-600">{shippoError}</p>}
          </div>
          <DialogFooter className="gap-2">
            {shippoFor?.has_shippo_key && (
              <Button variant="destructive" onClick={() => saveShippo(true)} disabled={shippoSaving}>Remove Key</Button>
            )}
            <Button variant="outline" onClick={() => setShippoFor(null)}>Cancel</Button>
            <Button onClick={() => saveShippo(false)} disabled={shippoSaving}>{shippoSaving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Receive Address Dialog */}
      <Dialog open={!!addAddrFor} onOpenChange={v => !v && setAddAddrFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Receive Address — {addAddrFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Label *</Label><Input value={addrForm.label} onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))} placeholder='e.g. "Unit B dock", "PO Box 12"' /></div>
            <div><Label>Name Line</Label><Input value={addrForm.address_name} onChange={e => setAddrForm(f => ({ ...f, address_name: e.target.value }))} placeholder='e.g. "SND Fulfillment" — the recipient line on the label' /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Address Line 1 *</Label><Input value={addrForm.address_line1} onChange={e => setAddrForm(f => ({ ...f, address_line1: e.target.value }))} /></div>
              <div><Label>Address Line 2</Label><Input value={addrForm.address_line2} onChange={e => setAddrForm(f => ({ ...f, address_line2: e.target.value }))} /></div>
              <div><Label>City</Label><Input value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} /></div>
              <div><Label>Postal Code</Label><Input value={addrForm.postal_code} onChange={e => setAddrForm(f => ({ ...f, postal_code: e.target.value }))} /></div>
              <div><Label>Country</Label><Input value={addrForm.country} onChange={e => setAddrForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={addrForm.notes} onChange={e => setAddrForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            {addrError && <p className="text-sm text-red-600">{addrError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAddrFor(null)}>Cancel</Button>
            <Button onClick={handleAddAddress} disabled={addrSaving}>{addrSaving ? 'Saving…' : 'Add Address'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
