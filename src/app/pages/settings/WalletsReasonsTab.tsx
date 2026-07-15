import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
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
import { Plus, Wallet, Tag, Lock, Pencil, Trash2 } from 'lucide-react';
import listWallets from '@/actions/settings/listWallets';
import createWallet from '@/actions/settings/createWallet';
import updateWallet from '@/actions/settings/updateWallet';
import deleteWallet from '@/actions/settings/deleteWallet';
import updateWalletActive from '@/actions/settings/updateWalletActive';
import listFreeOrderReasons from '@/actions/settings/listFreeOrderReasons';
import createFreeOrderReason from '@/actions/settings/createFreeOrderReason';
import updateFreeOrderReason from '@/actions/settings/updateFreeOrderReason';
import deleteFreeOrderReason from '@/actions/settings/deleteFreeOrderReason';
import updateFreeOrderReasonActive from '@/actions/settings/updateFreeOrderReasonActive';

type Wallet = { id: number; asset: string; network: string; address: string; label: string; is_active: boolean; notes: string; is_used: boolean };
type FreeReason = { id: number; label: string; description: string; is_active: boolean; is_used: boolean };

const VALID_COMBOS = [
  { asset: 'USDC', network: 'ethereum' }, { asset: 'USDC', network: 'solana' },
  { asset: 'USDT', network: 'ethereum' }, { asset: 'USDT', network: 'solana' },
  { asset: 'ETH', network: 'ethereum' }, { asset: 'SOL', network: 'solana' },
  { asset: 'BTC', network: 'bitcoin' },
];

export function WalletsReasonsTab() {
  // Wallet dialog state: showWalletForm opens the dialog; editWallet != null
  // means it's editing that wallet, otherwise adding.
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [wCombo, setWCombo] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [wLabel, setWLabel] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [wSaving, setWSaving] = useState(false);
  const [wError, setWError] = useState('');

  const [showReasonForm, setShowReasonForm] = useState(false);
  const [editReason, setEditReason] = useState<FreeReason | null>(null);
  const [rLabel, setRLabel] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rSaving, setRSaving] = useState(false);
  const [rError, setRError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'wallet' | 'reason'; id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [wallets, , , reloadWallets] = useLoadAction(listWallets, [], {});
  const [reasons, , , reloadReasons] = useLoadAction(listFreeOrderReasons, [], {});
  const [doCreateWallet] = useMutateAction(createWallet);
  const [doUpdateWallet] = useMutateAction(updateWallet);
  const [doDeleteWallet] = useMutateAction(deleteWallet);
  const [doToggleWallet] = useMutateAction(updateWalletActive);
  const [doCreateReason] = useMutateAction(createFreeOrderReason);
  const [doUpdateReason] = useMutateAction(updateFreeOrderReason);
  const [doDeleteReason] = useMutateAction(deleteFreeOrderReason);
  const [doToggleReason] = useMutateAction(updateFreeOrderReasonActive);

  const walletList = asRows<Wallet>(wallets);
  const reasonList = asRows<FreeReason>(reasons);

  const [toggleError, setToggleError] = useState('');
  const toggleWallet = async (w: Wallet) => {
    setToggleError('');
    const res = await doToggleWallet({ id: w.id, is_active: !w.is_active }) as unknown[];
    if (!w.is_active && (!res || res.length === 0)) {
      setToggleError(`Can't activate ${w.label || `${w.asset}/${w.network}`} — another active ${w.asset}/${w.network} wallet already exists. Deactivate it first.`);
    }
    reloadWallets();
  };

  const openAddWallet = () => {
    setEditWallet(null); setWCombo(''); setWAddress(''); setWLabel(''); setWNotes(''); setWError('');
    setShowWalletForm(true);
  };
  const openEditWallet = (w: Wallet) => {
    setEditWallet(w); setWCombo(`${w.asset}/${w.network}`); setWAddress(w.address);
    setWLabel(w.label || ''); setWNotes(w.notes || ''); setWError('');
    setShowWalletForm(true);
  };

  const handleSaveWallet = async () => {
    if (!wCombo || !wAddress) { setWError('Asset/network and address are required.'); return; }
    const [asset, network] = wCombo.split('/');
    const dup = walletList.find(w => w.is_active && w.asset === asset && w.network === network && w.id !== editWallet?.id);
    if (dup && (editWallet ? editWallet.is_active : true)) { setWError(`An active ${wCombo} wallet already exists.`); return; }
    setWSaving(true); setWError('');
    try {
      if (editWallet) {
        const res = await doUpdateWallet({ id: editWallet.id, asset, network, address: wAddress, label: wLabel || `${asset} ${network}`, notes: wNotes || null }) as { id: number; locked: boolean }[];
        // A payment may have referenced the wallet between opening the
        // dialog and saving — the SQL then keeps asset/network/address.
        // Don't close as if those edits saved.
        const wantedLockedChange = wAddress !== editWallet.address || asset !== editWallet.asset || network !== editWallet.network;
        if (res?.[0]?.locked && !editWallet.is_used && wantedLockedChange) {
          setWError('A payment was just recorded against this wallet, so the asset, network, and address are now locked — label and notes were saved, the rest kept their original values.');
          reloadWallets();
          return;
        }
      } else {
        await doCreateWallet({ asset, network, address: wAddress, label: wLabel || `${asset} ${network}`, notes: wNotes || null });
      }
      setShowWalletForm(false);
      reloadWallets();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save wallet';
      setWError(msg.includes('receive_wallets_one_active_per_combo')
        ? `An active ${wCombo} wallet already exists — deactivate it first.`
        : msg);
    } finally { setWSaving(false); }
  };

  const openAddReason = () => {
    setEditReason(null); setRLabel(''); setRDesc(''); setRError('');
    setShowReasonForm(true);
  };
  const openEditReason = (r: FreeReason) => {
    setEditReason(r); setRLabel(r.label); setRDesc(r.description || ''); setRError('');
    setShowReasonForm(true);
  };

  const handleSaveReason = async () => {
    if (!rLabel.trim()) { setRError('Label is required.'); return; }
    const dup = reasonList.find(r => r.label.toLowerCase() === rLabel.trim().toLowerCase() && r.id !== editReason?.id);
    if (dup) { setRError('A reason with this label already exists.'); return; }
    setRSaving(true); setRError('');
    try {
      if (editReason) {
        const res = await doUpdateReason({ id: editReason.id, label: rLabel.trim(), description: rDesc || null }) as { id: number; locked: boolean }[];
        if (res?.[0]?.locked && !editReason.is_used && rLabel.trim() !== editReason.label) {
          setRError('An order just used this reason, so the label is now locked — the description was saved, the label kept its original value.');
          reloadReasons();
          return;
        }
      } else {
        await doCreateReason({ label: rLabel.trim(), description: rDesc || null });
      }
      setShowReasonForm(false);
      reloadReasons();
    } catch (e: unknown) {
      setRError(e instanceof Error ? e.message : 'Failed to save reason');
    } finally { setRSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true); setDeleteError('');
    try {
      const res = confirmDelete.kind === 'wallet'
        ? await doDeleteWallet({ id: confirmDelete.id }) as unknown[]
        : await doDeleteReason({ id: confirmDelete.id }) as unknown[];
      if (!res || res.length === 0) {
        setDeleteError(confirmDelete.kind === 'wallet'
          ? 'This wallet has payments recorded against it and cannot be deleted — deactivate it instead.'
          : 'This reason is used on orders and cannot be deleted — deactivate it instead.');
        return;
      }
      setConfirmDelete(null);
      if (confirmDelete.kind === 'wallet') reloadWallets(); else reloadReasons();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Wallets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Receive Wallets</CardTitle>
            <Button size="sm" onClick={openAddWallet} className="flex items-center gap-1">
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
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletList.map(w => (
                <TableRow key={w.id} className={!w.is_active ? 'opacity-50' : ''}>
                  <TableCell><Badge className="bg-blue-100 text-blue-800 font-mono">{w.asset}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-600">{w.network}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-600 max-w-[200px] truncate">{w.address}</TableCell>
                  <TableCell className="text-sm">{w.label}</TableCell>
                  <TableCell className="text-center"><Switch checked={!!w.is_active} onCheckedChange={() => toggleWallet(w)} /></TableCell>
                  <TableCell className="text-right pr-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit wallet" onClick={() => openEditWallet(w)}><Pencil className="h-3 w-3" /></Button>
                    {w.is_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}><Button size="icon" variant="ghost" className="h-7 w-7 text-gray-300" disabled><Trash2 className="h-3 w-3" /></Button></span>
                          </TooltipTrigger>
                          <TooltipContent>Payments reference this wallet — deactivate instead of deleting</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete wallet" onClick={() => { setDeleteError(''); setConfirmDelete({ kind: 'wallet', id: w.id, name: w.label || `${w.asset}/${w.network}` }); }}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {walletList.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400">No wallets</TableCell></TableRow>}
            </TableBody>
          </Table>
          {toggleError && <p className="text-sm text-red-600 bg-red-50 rounded p-2 m-3">{toggleError}</p>}
        </CardContent>
      </Card>

      {/* Free Order Reasons */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Free Order Reasons</CardTitle>
            <Button size="sm" onClick={openAddReason} className="flex items-center gap-1">
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
                <TableHead className="text-right pr-4">Actions</TableHead>
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
                  <TableCell className="text-right pr-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit reason" onClick={() => openEditReason(r)}><Pencil className="h-3 w-3" /></Button>
                    {r.is_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}><Button size="icon" variant="ghost" className="h-7 w-7 text-gray-300" disabled><Trash2 className="h-3 w-3" /></Button></span>
                          </TooltipTrigger>
                          <TooltipContent>Orders use this reason — deactivate instead of deleting</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete reason" onClick={() => { setDeleteError(''); setConfirmDelete({ kind: 'reason', id: r.id, name: r.label }); }}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {reasonList.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400">No reasons</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Wallet Dialog */}
      <Dialog open={showWalletForm} onOpenChange={v => !v && setShowWalletForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editWallet ? 'Edit Receive Wallet' : 'Add Receive Wallet'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editWallet?.is_used && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Payments reference this wallet, so the asset, network, and address are locked — only label and notes can change.
              </p>
            )}
            <div>
              <Label>Asset / Network *</Label>
              <Select value={wCombo} onValueChange={setWCombo} disabled={!!editWallet?.is_used}>
                <SelectTrigger><SelectValue placeholder="Select asset/network" /></SelectTrigger>
                <SelectContent>
                  {VALID_COMBOS.map(c => (
                    <SelectItem key={`${c.asset}/${c.network}`} value={`${c.asset}/${c.network}`}>{c.asset} / {c.network}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Wallet Address *</Label><Input value={wAddress} onChange={e => setWAddress(e.target.value)} placeholder="0x… or wallet address" disabled={!!editWallet?.is_used} /></div>
            <div><Label>Label</Label><Input value={wLabel} onChange={e => setWLabel(e.target.value)} placeholder="e.g. Main USDC wallet" /></div>
            <div><Label>Notes</Label><Textarea value={wNotes} onChange={e => setWNotes(e.target.value)} rows={2} /></div>
            {wError && <p className="text-sm text-red-600">{wError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalletForm(false)}>Cancel</Button>
            <Button onClick={handleSaveWallet} disabled={wSaving}>{wSaving ? 'Saving…' : editWallet ? 'Save Changes' : 'Add Wallet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Reason Dialog */}
      <Dialog open={showReasonForm} onOpenChange={v => !v && setShowReasonForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editReason ? 'Edit Free Order Reason' : 'Add Free Order Reason'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label * (unique, immutable once used)</Label>
              <Input value={rLabel} onChange={e => setRLabel(e.target.value)} placeholder="e.g. Staff Sample" disabled={!!editReason?.is_used} />
              {editReason?.is_used && <p className="text-xs text-muted-foreground mt-1">Used on orders — the label is locked; only the description can change.</p>}
            </div>
            <div><Label>Description</Label><Textarea value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2} /></div>
            {rError && <p className="text-sm text-red-600">{rError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonForm(false)}>Cancel</Button>
            <Button onClick={handleSaveReason} disabled={rSaving}>{rSaving ? 'Saving…' : editReason ? 'Save Changes' : 'Add Reason'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && !deleting && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {confirmDelete?.kind === 'wallet' ? 'Wallet' : 'Reason'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <span className="font-medium text-foreground">{confirmDelete?.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
