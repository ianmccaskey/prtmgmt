import React, { useEffect, useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getMyLabelReturnAddress from '@/actions/settings/getMyLabelReturnAddress';
import updateMyLabelReturnAddress from '@/actions/settings/updateMyLabelReturnAddress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type ReturnAddrRow = {
  label_return_name: string | null; label_return_line1: string | null; label_return_line2: string | null;
  label_return_city: string | null; label_return_state: string | null; label_return_postal: string | null;
  label_return_country: string | null; label_return_phone: string | null;
};

const EMPTY = { name: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US', phone: '' };

/**
 * Self-service per-user settings (opened from the header user chip).
 * Currently: the return address printed on Shippo labels this user buys.
 * Blank = fall back to the shipping warehouse's ship-from address.
 */
export function MySettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profileId, displayName } = useAppUser();
  const [raw, loading, , reload] = useLoadAction(getMyLabelReturnAddress, [profileId, open ? 1 : 0], { user_id: profileId }, { enabled: open && profileId != null });
  const [doSave] = useMutateAction(updateMyLabelReturnAddress);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const r = asRows<ReturnAddrRow>(raw)[0];
    if (!r) return;
    setForm({
      name: r.label_return_name || '',
      line1: r.label_return_line1 || '',
      line2: r.label_return_line2 || '',
      city: r.label_return_city || '',
      state: r.label_return_state || '',
      postal: dbText(r.label_return_postal),
      country: r.label_return_country || 'US',
      phone: dbText(r.label_return_phone),
    });
  }, [raw, open]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const partial = !!(form.line1 || form.city || form.postal) && !(form.line1 && form.city && form.postal);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await doSave({
        user_id: profileId,
        name: form.name.trim(), line1: form.line1.trim(), line2: form.line2.trim(),
        city: form.city.trim(), state: form.state.trim(),
        // dbText: never persist a leading '#' (it's the read-side numeric guard)
        postal: dbText(form.postal.trim()),
        country: form.country.trim(), phone: dbText(form.phone.trim()),
      });
      reload();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-lg">
        <DialogHeader><DialogTitle>My Settings — {displayName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Shippo label return address</p>
            <p className="text-xs text-muted-foreground">
              Printed as the from/return address on shipping labels you buy through Mark Shipped.
              Leave blank to use the warehouse&apos;s ship-from address.
            </p>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label className="text-xs">Name line</Label><Input value={form.name} onChange={set('name')} placeholder="e.g. OK Fulfillment" /></div>
              <div className="col-span-2"><Label className="text-xs">Address Line 1</Label><Input value={form.line1} onChange={set('line1')} /></div>
              <div className="col-span-2"><Label className="text-xs">Address Line 2</Label><Input value={form.line2} onChange={set('line2')} /></div>
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={set('city')} /></div>
              <div><Label className="text-xs">State</Label><Input value={form.state} onChange={set('state')} /></div>
              <div><Label className="text-xs">Postal Code</Label><Input value={form.postal} onChange={set('postal')} /></div>
              <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={set('country')} placeholder="US" /></div>
              <div className="col-span-2"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" /></div>
            </div>
          )}
          {partial && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
              Address line 1, city, and postal code are all needed before this address is used on labels —
              incomplete addresses fall back to the warehouse ship-from.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
