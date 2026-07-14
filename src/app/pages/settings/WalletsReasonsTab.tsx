import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Wallet, Tag, Lock } from 'lucide-react';
import listWallets from '@/actions/settings/listWallets';
import createWallet from '@/actions/settings/createWallet';
import updateWalletActive from '@/actions/settings/updateWalletActive';
import listFreeOrderReasons from '@/actions/settings/listFreeOrderReasons';
import createFreeOrderReason from '@/actions/settings/createFreeOrderReason';
import updateFreeOrderReasonActive from '@/actions/settings/updateFreeOrderReasonActive';

type Wallet = { id: number; asset: string; network: string; address: string; label: string; is_active: boolean; notes: string };
type FreeReason = { id: number; label: string; description: string; is_active: boolean; is_used: boolean };

const VALID_COMBOS = [
  { asset: 'USDC', network: 'ethereum' }, { asset: 'USDC', network: 'solana' },
  { asset: 'USDT', network: 'ethereum' }, { asset: 'USDT', network: 'solana' },
  { asset: 'ETH', network: 'ethereum' }, { asset: 'SOL', network: 'solana' },
  { asset: 'BTC', network: 'bitcoin' },
];

export function WalletsReasonsTab() {
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [wCombo, setWCombo] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [wLabel, setWLabel] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [wSaving, setWSaving] = useState(false);
  const [wError, setWError] = useState('');

  const [showAddReason, setShowAddReason] = useState(false);
  const [rLabel, setRLabel] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rSaving, setRSaving] = useState(false);
  const [rError, setRError] = useState('');

  const [wallets, , , reloadWallets] = useLoadAction(listWallets, [], {});
  const [reasons, , , reloadReasons] = useLoadAction(listFreeOrderReasons, [], {});
  const [doCreateWallet] = useMutateAction(createWallet);
  const [doToggleWallet] = useMutateAction(updateWalletActive);
  const [doCreateReason] = useMutateAction(createFreeOrderReason);
  const [doToggleReason] = useMutateAction(updateFreeOrderReasonActive);

  const walletList = (wallets as Wallet[]) || [];
  const reasonList = (reasons as FreeReason[]) || [];

  const handleAddWallet = async () => {
    if (!wCombo || !wAddress) { setWError('Asset/network and address are required.'); return; }
    const [asset, network] = wCombo.split('/');
    const dup = walletList.find(w => w.is_active && w.asset === asset && w.network === network);
    if (dup) { setWError(`An active ${wCombo} wallet already exists.`); return; }
    setWSaving(true); setWError('');
    try {
      await doCreateWallet({ asset, network, address: wAddress, label: wLabel || `${asset} ${network}`, notes: wNotes || null });
      setShowAddWallet(false); setWCombo(''); setWAddress(''); setWLabel(''); setWNotes('');
      reloadWallets();
    } catch (e: unknown) {
      setWError(e instanceof Error ? e.message : 'Failed to create wallet');
    } finally { setWSaving(false); }
  };

  const handleAddReason = async () => {
    if (!rLabel.trim()) { setRError('Label is required.'); return; }
    const dup = reasonList.find(r => r.label.toLowerCase() === rLabel.trim().toLowerCase());
    if (dup) { setRError('A reason with this label already exists.'); return; }
    setRSaving(true); setRError('');
    try {
      await doCreateReason({ label: rLabel.trim(), description: rDesc || null });
      setShowAddReason(false); setRLabel(''); setRDesc('');
      reloadReasons();
    } catch (e: unknown) {
      setRError(e instanceof Error ? e.message : 'Failed to create reason');
    } finally { setRSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Wallets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Receive Wallets</CardTitle>
            <Button size="sm" onClick={() => setShowAddWallet(true)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Wallet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletList.map(w => (
                <TableRow key={w.id} className={!w.is_active ? 'opacity-50' : ''}>
                  <TableCell><Badge className="bg-blue-100 text-blue-800 font-mono">{w.asset}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-600">{w.network}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-600 max-w-[200px] truncate">{w.address}</TableCell>
                  <TableCell className="text-sm">{w.label}</TableCell>
                  <TableCell className="text-center"><Switch checked={!!w.is_active} onCheckedChange={async () => { await doToggleWallet({ id: w.id, is_active: !w.is_active }); reloadWallets(); }} /></TableCell>
                </TableRow>
              ))}
              {walletList.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400">No wallets</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Free Order Reasons */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Free Order Reasons</CardTitle>
            <Button size="sm" onClick={() => setShowAddReason(true)} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Reason
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Used</TableHead>
                <TableHead className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reasonList.map(r => (
                <TableRow key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium text-sm">{r.label}</TableCell>
                  <TableCell className="text-sm text-gray-500">{r.description || '—'}</TableCell>
                  <TableCell className="text-center">
                    {r.is_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Lock className="h-3 w-3 text-amber-500 mx-auto" /></TooltipTrigger>
                          <TooltipContent>Label is immutable — used on an order</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-center"><Switch checked={!!r.is_active} onCheckedChange={async () => { await doToggleReason({ id: r.id, is_active: !r.is_active }); reloadReasons(); }} /></TableCell>
                </TableRow>
              ))}
              {reasonList.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400">No reasons</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Wallet Dialog */}
      <Dialog open={showAddWallet} onOpenChange={v => !v && setShowAddWallet(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Receive Wallet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Asset / Network *</Label>
              <Select value={wCombo} onValueChange={setWCombo}>
                <SelectTrigger><SelectValue placeholder="Select asset/network" /></SelectTrigger>
                <SelectContent>
                  {VALID_COMBOS.map(c => (
                    <SelectItem key={`${c.asset}/${c.network}`} value={`${c.asset}/${c.network}`}>{c.asset} / {c.network}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Wallet Address *</Label><Input value={wAddress} onChange={e => setWAddress(e.target.value)} placeholder="0x… or wallet address" /></div>
            <div><Label>Label</Label><Input value={wLabel} onChange={e => setWLabel(e.target.value)} placeholder="e.g. Main USDC wallet" /></div>
            <div><Label>Notes</Label><Textarea value={wNotes} onChange={e => setWNotes(e.target.value)} rows={2} /></div>
            {wError && <p className="text-sm text-red-600">{wError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWallet(false)}>Cancel</Button>
            <Button onClick={handleAddWallet} disabled={wSaving}>{wSaving ? 'Saving…' : 'Add Wallet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reason Dialog */}
      <Dialog open={showAddReason} onOpenChange={v => !v && setShowAddReason(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Free Order Reason</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Label * (unique, immutable once used)</Label><Input value={rLabel} onChange={e => setRLabel(e.target.value)} placeholder="e.g. Staff Sample" /></div>
            <div><Label>Description</Label><Textarea value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2} /></div>
            {rError && <p className="text-sm text-red-600">{rError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReason(false)}>Cancel</Button>
            <Button onClick={handleAddReason} disabled={rSaving}>{rSaving ? 'Saving…' : 'Add Reason'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
