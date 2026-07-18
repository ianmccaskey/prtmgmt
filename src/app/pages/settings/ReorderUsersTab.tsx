import React, { useState, useEffect } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import listUserPayoutAddresses from '@/actions/settings/listUserPayoutAddresses';
import createUserPayoutAddress from '@/actions/settings/createUserPayoutAddress';
import deleteUserPayoutAddress from '@/actions/settings/deleteUserPayoutAddress';
import getAppSetting from '@/actions/settings/getAppSetting';
import upsertAppSetting from '@/actions/settings/upsertAppSetting';
import listUserProfiles from '@/actions/settings/listUserProfiles';
import upsertUserProfile from '@/actions/settings/upsertUserProfile';
import updateUserProfileById from '@/actions/settings/updateUserProfileById';
import listWarehouses from '@/actions/settings/listWarehouses';
import { FileUpload } from '@/components/FileUpload';

type UserProfile = {
  id: number; user_id: number | null; email: string | null; role: string; assigned_warehouse_id: number | null;
  display_name: string; avatar_file: string | null; created_at: string;
  assigned_warehouse_name: string | null;
};
type Warehouse = { id: number; name: string; is_active: boolean };
type AppSetting = { key: string; value: string };
type PayoutAddress = { id: number; user_profile_id: number; asset: string; network: string; address: string; label: string | null };

const ROLES = ['admin', 'sales_rep', 'warehouse', 'logistics'];
const PAYOUT_COMBOS = [
  { asset: 'USDC', network: 'ethereum' }, { asset: 'USDC', network: 'solana' },
  { asset: 'USDT', network: 'ethereum' }, { asset: 'USDT', network: 'solana' },
  { asset: 'ETH', network: 'ethereum' }, { asset: 'SOL', network: 'solana' },
  { asset: 'BTC', network: 'bitcoin' },
];

function Initials({ name }: { name: string }) {
  const parts = (name || '?').split(' ');
  const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

export function ReorderUsersTab() {
  const [coverDays, setCoverDays] = useState('60');
  const [coverSaved, setCoverSaved] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [uEmail, setUEmail] = useState('');
  const [uDisplayName, setUDisplayName] = useState('');
  const [uRole, setURole] = useState('sales_rep');
  const [uWarehouse, setUWarehouse] = useState('');
  const [uSaving, setUSaving] = useState(false);
  const [uError, setUError] = useState('');
  const [uAvatar, setUAvatar] = useState('');

  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Saved, setS3Saved] = useState(false);
  const [s3Setting] = useLoadAction(getAppSetting, [], { key: 's3_presign_endpoint' });
  const s3Row = (asRows<AppSetting>(s3Setting))[0];
  useEffect(() => { if (s3Row?.value != null) setS3Endpoint(s3Row.value); }, [s3Row?.value]);

  const [setting] = useLoadAction(getAppSetting, [], { key: 'reorder_cover_days' });
  const [users, , , reloadUsers] = useLoadAction(listUserProfiles, [], {});
  const [warehouses] = useLoadAction(listWarehouses, [], {});
  const [doUpsertSetting] = useMutateAction(upsertAppSetting);
  const [doUpsertUser] = useMutateAction(upsertUserProfile);
  const [doUpdateUser] = useMutateAction(updateUserProfileById);

  // Payout addresses for the user being edited
  const [paCombo, setPaCombo] = useState('');
  const [paAddress, setPaAddress] = useState('');
  const [paLabel, setPaLabel] = useState('');
  const [paSaving, setPaSaving] = useState(false);
  const [payoutRaw, , , reloadPayouts] = useLoadAction(listUserPayoutAddresses, [editUser?.id], { user_profile_id: editUser?.id ?? 0 }, { enabled: !!editUser });
  const payoutList = asRows<PayoutAddress>(payoutRaw);
  const [doCreatePayout] = useMutateAction(createUserPayoutAddress);
  const [doDeletePayout] = useMutateAction(deleteUserPayoutAddress);

  const addPayout = async () => {
    if (!editUser || !paCombo || !paAddress.trim()) return;
    const [asset, network] = paCombo.split('/');
    setPaSaving(true);
    try {
      await doCreatePayout({ user_profile_id: editUser.id, asset, network, address: paAddress, label: paLabel || null });
      setPaCombo(''); setPaAddress(''); setPaLabel('');
      reloadPayouts();
    } finally { setPaSaving(false); }
  };
  const removePayout = async (id: number) => {
    await doDeletePayout({ id });
    reloadPayouts();
  };

  const settingRow = (asRows<AppSetting>(setting))[0];
  const userList = asRows<UserProfile>(users);
  const warehouseList = asRows<Warehouse>(warehouses);

  useEffect(() => {
    if (settingRow?.value) setCoverDays(settingRow.value);
  }, [settingRow?.value]);

  const saveCoverDays = async () => {
    setCoverSaving(true);
    try {
      await doUpsertSetting({ key: 'reorder_cover_days', value: String(Number(coverDays)) });
      setCoverSaved(true);
      setTimeout(() => setCoverSaved(false), 2000);
    } finally { setCoverSaving(false); }
  };

  const openAdd = () => {
    setEditUser(null); setUEmail(''); setUDisplayName(''); setURole('sales_rep'); setUWarehouse(''); setUError(''); setUAvatar('');
    setPaCombo(''); setPaAddress(''); setPaLabel('');
    setShowAddUser(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setUEmail(u.email || ''); setUDisplayName(u.display_name); setURole(u.role);
    setUWarehouse(u.assigned_warehouse_id ? String(u.assigned_warehouse_id) : '');
    setUError(''); setUAvatar('');
    // Stale payout-form input must never carry over to another user.
    setPaCombo(''); setPaAddress(''); setPaLabel('');
    setShowAddUser(true);
  };

  const saveS3Endpoint = async () => {
    await doUpsertSetting({ key: 's3_presign_endpoint', value: s3Endpoint.trim() });
    setS3Saved(true);
    setTimeout(() => setS3Saved(false), 2000);
  };

  const handleSaveUser = async () => {
    if (!uDisplayName.trim()) { setUError('Display name is required.'); return; }
    if (!uEmail.trim() || !uEmail.includes('@')) { setUError('A valid email is required — it links this profile to the UI Bakery login.'); return; }
    // Warehouse role requires an assignment; admins and sales reps may
    // optionally take one (any role can also work a warehouse).
    if (uRole === 'warehouse' && !uWarehouse) { setUError('Warehouse users must be assigned to a warehouse.'); return; }
    setUSaving(true); setUError('');
    try {
      const payload = {
        email: uEmail.trim(),
        display_name: uDisplayName.trim(),
        role: uRole,
        assigned_warehouse_id: uWarehouse ? Number(uWarehouse) : null,
      };
      if (editUser) {
        await doUpdateUser({ id: editUser.id, ...payload, avatar_file: uAvatar || null });
      } else {
        await doUpsertUser({ user_id: null, ...payload });
      }
      setShowAddUser(false);
      reloadUsers();
    } catch (e: unknown) {
      setUError(e instanceof Error ? e.message : 'Failed to save user');
    } finally { setUSaving(false); }
  };

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    sales_rep: 'bg-blue-100 text-blue-700',
    warehouse: 'bg-amber-100 text-amber-700',
    logistics: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="space-y-6">
      {/* Reorder Planning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Reorder Planning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label>Reorder Cover Days</Label>
              <p className="text-xs text-gray-400 mb-1">Days of stock to target when creating reorder recommendations</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={365} value={coverDays}
                  onChange={e => setCoverDays(e.target.value)}
                  className="w-24"
                />
                <Button onClick={saveCoverDays} disabled={coverSaving} size="sm">
                  {coverSaved ? '✓ Saved' : coverSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>S3 Presign Endpoint</Label>
          <p className="text-xs text-gray-400 mb-1">
            URL of the presigned-upload endpoint for product images, avatars, and evidence files (see docs/S3_SETUP.md).
            Leave blank to store small files inline.
          </p>
          <div className="flex items-center gap-2 max-w-xl">
            <Input type="url" placeholder="https://xxxx.lambda-url.us-east-1.on.aws/" value={s3Endpoint} onChange={e => setS3Endpoint(e.target.value)} />
            <Button size="sm" onClick={saveS3Endpoint}>{s3Saved ? '✓ Saved' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> User Management</CardTitle>
            <Button size="sm" onClick={openAdd} className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userList.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.avatar_file
                        ? <img src={u.avatar_file} className="w-8 h-8 rounded-full object-cover" alt={u.display_name} />
                        : <Initials name={u.display_name} />}
                      <div>
                        <div className="font-medium text-sm">{u.display_name}</div>
                        <div className="text-xs text-gray-400">{u.email || `ID: ${u.user_id ?? '—'}`}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={`capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>{u.role.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-600">{u.assigned_warehouse_name || '—'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {userList.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400">No users configured</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={showAddUser} onOpenChange={v => !v && setShowAddUser(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Login Email *</Label>
              <Input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="user@example.com" />
              <p className="text-xs text-gray-400 mt-0.5">Must match the email this person signs in to UI Bakery with — it links their login to this role</p>
            </div>
            <div><Label>Display Name *</Label><Input value={uDisplayName} onChange={e => setUDisplayName(e.target.value)} placeholder="e.g. Jane Smith" /></div>
            <div>
              <Label>Role *</Label>
              <Select value={uRole} onValueChange={setURole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editUser && (
              <div>
                <Label>Avatar</Label>
                <div className="flex items-center gap-3 mt-1">
                  {(uAvatar || editUser.avatar_file)
                    ? <img src={uAvatar || editUser.avatar_file || ''} className="w-10 h-10 rounded-full object-cover" alt="avatar preview" />
                    : <Initials name={uDisplayName || editUser.display_name} />}
                  <FileUpload accept="image/*" label="Upload avatar" onUploaded={setUAvatar} />
                </div>
              </div>
            )}
            <div>
              <Label>Assigned Warehouse {uRole === 'warehouse' ? '*' : '(optional)'}</Label>
              <Select value={uWarehouse || '_none'} onValueChange={v => setUWarehouse(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {warehouseList.filter(w => w.is_active).map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editUser && (
              <div className="border rounded p-3 space-y-2">
                <Label className="font-medium flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Payout Addresses</Label>
                <p className="text-xs text-muted-foreground">Where this user gets paid — shown when recording commission payments.</p>
                {payoutList.map(pa => (
                  <div key={pa.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded p-2">
                    <Badge variant="outline" className="px-1 py-0 font-mono shrink-0">{pa.asset}/{pa.network}</Badge>
                    <code className="flex-1 break-all">{pa.address}</code>
                    {pa.label && <span className="text-muted-foreground shrink-0">{pa.label}</span>}
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 shrink-0" onClick={() => removePayout(pa.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {payoutList.length === 0 && <p className="text-xs text-muted-foreground">No addresses yet.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Select value={paCombo} onValueChange={setPaCombo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Asset / network" /></SelectTrigger>
                    <SelectContent>
                      {PAYOUT_COMBOS.map(c => (
                        <SelectItem key={`${c.asset}/${c.network}`} value={`${c.asset}/${c.network}`}>{c.asset} / {c.network}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="h-8 text-xs" placeholder="Label (optional)" value={paLabel} onChange={e => setPaLabel(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Input className="h-8 text-xs flex-1" placeholder="Address (0x… / bc1…)" value={paAddress} onChange={e => setPaAddress(e.target.value)} />
                  <Button size="sm" className="h-8" onClick={addPayout} disabled={paSaving || !paCombo || !paAddress.trim()}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
            )}
            {uError && <p className="text-sm text-red-600">{uError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={uSaving}>{uSaving ? 'Saving…' : editUser ? 'Save Changes' : 'Add User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
