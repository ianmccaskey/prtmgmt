import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, Plus, Pencil } from 'lucide-react';
import getAppSetting from '@/actions/settings/getAppSetting';
import upsertAppSetting from '@/actions/settings/upsertAppSetting';
import listUserProfiles from '@/actions/settings/listUserProfiles';
import upsertUserProfile from '@/actions/settings/upsertUserProfile';
import listWarehouses from '@/actions/settings/listWarehouses';

type UserProfile = {
  id: number; user_id: number; role: string; assigned_warehouse_id: number | null;
  display_name: string; avatar_file: string | null; created_at: string;
  assigned_warehouse_name: string | null;
};
type Warehouse = { id: number; name: string; is_active: boolean };
type AppSetting = { key: string; value: string };

const ROLES = ['admin', 'sales_rep', 'warehouse'];

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
  const [uUserId, setUUserId] = useState('');
  const [uDisplayName, setUDisplayName] = useState('');
  const [uRole, setURole] = useState('sales_rep');
  const [uWarehouse, setUWarehouse] = useState('');
  const [uSaving, setUSaving] = useState(false);
  const [uError, setUError] = useState('');

  const [setting] = useLoadAction(getAppSetting, [], { key: 'reorder_cover_days' });
  const [users, , , reloadUsers] = useLoadAction(listUserProfiles, [], {});
  const [warehouses] = useLoadAction(listWarehouses, [], {});
  const [doUpsertSetting] = useMutateAction(upsertAppSetting);
  const [doUpsertUser] = useMutateAction(upsertUserProfile);

  const settingRow = ((setting as AppSetting[]) || [])[0];
  const userList = (users as UserProfile[]) || [];
  const warehouseList = (warehouses as Warehouse[]) || [];

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
    setEditUser(null); setUUserId(''); setUDisplayName(''); setURole('sales_rep'); setUWarehouse(''); setUError('');
    setShowAddUser(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setUUserId(String(u.user_id)); setUDisplayName(u.display_name); setURole(u.role);
    setUWarehouse(u.assigned_warehouse_id ? String(u.assigned_warehouse_id) : '');
    setUError(''); setShowAddUser(true);
  };

  const handleSaveUser = async () => {
    if (!uDisplayName.trim()) { setUError('Display name is required.'); return; }
    if (!editUser && !uUserId) { setUError('User ID is required.'); return; }
    setUSaving(true); setUError('');
    try {
      await doUpsertUser({
        user_id: editUser ? editUser.user_id : Number(uUserId),
        display_name: uDisplayName.trim(),
        role: uRole,
        assigned_warehouse_id: (uRole === 'warehouse' && uWarehouse) ? Number(uWarehouse) : null,
      });
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
                        <div className="text-xs text-gray-400">ID: {u.user_id}</div>
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
            {!editUser && (
              <div>
                <Label>UI Bakery User ID *</Label>
                <Input type="number" value={uUserId} onChange={e => setUUserId(e.target.value)} placeholder="User ID from UI Bakery" />
                <p className="text-xs text-gray-400 mt-0.5">Enter the numeric ID of an existing UI Bakery platform user</p>
              </div>
            )}
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
            {uRole === 'warehouse' && (
              <div>
                <Label>Assigned Warehouse</Label>
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
