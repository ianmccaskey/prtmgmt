import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import updateBatchQcStatusAction from '@/actions/batches/updateBatchQcStatus';
import rollupBatchQcAction from '@/actions/batches/rollupBatchQc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

type Batch = { id: number; qc_status: string; notes: string };

/**
 * QC status is derived automatically from the newest HPLC + mass-spec tests
 * (rollupBatchQc). The only manual controls are quarantine (overrides the
 * roll-up, requires a note) and release (re-runs the roll-up).
 */
export function BatchQcPanel({ batch, onRefresh }: { batch: Batch; onRefresh: () => void }) {
  const [updateQc] = useMutateAction(updateBatchQcStatusAction);
  const [rollup] = useMutateAction(rollupBatchQcAction);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const isQuarantined = batch.qc_status === 'quarantine';

  const quarantine = async () => {
    if (!note.trim()) return;
    setSaving('quarantine');
    await updateQc({ id: batch.id, qc_status: 'quarantine', notes: note });
    setNote('');
    setSaving(null);
    onRefresh();
  };

  const release = async () => {
    setSaving('release');
    // First drop the quarantine override, then let the test roll-up decide.
    await updateQc({ id: batch.id, qc_status: 'pending', notes: note || null });
    await rollup({ batch_id: batch.id });
    setNote('');
    setSaving(null);
    onRefresh();
  };

  const recompute = async () => {
    setSaving('recompute');
    await rollup({ batch_id: batch.id });
    setSaving(null);
    onRefresh();
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">QC Controls</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-slate-600 mb-1">Current QC Status:</p>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
            batch.qc_status === 'passed' ? 'bg-green-100 text-green-700' :
            batch.qc_status === 'failed' ? 'bg-red-100 text-red-700' :
            isQuarantined ? 'bg-orange-100 text-orange-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>{batch.qc_status}</span>
          <p className="text-xs text-slate-400 mt-1.5">
            Passed / failed / pending are derived from the newest HPLC purity and mass-spec results.
            Quarantine is a manual override and blocks the batch from fulfillment until released.
          </p>
        </div>

        <div>
          <Label>Note (required for quarantine)</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason or notes for this QC action…" rows={2} className="mt-1" />
        </div>

        <div className="flex flex-wrap gap-2">
          {!isQuarantined ? (
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              disabled={saving !== null || !note.trim()}
              onClick={quarantine}
            >
              <ShieldAlert className="h-4 w-4 mr-1" />{saving === 'quarantine' ? 'Updating…' : 'Send to Quarantine'}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              disabled={saving !== null}
              onClick={release}
            >
              <ShieldCheck className="h-4 w-4 mr-1" />{saving === 'release' ? 'Releasing…' : 'Release from Quarantine'}
            </Button>
          )}
          <Button variant="outline" disabled={saving !== null || isQuarantined} onClick={recompute}>
            <RefreshCw className="h-4 w-4 mr-1" />{saving === 'recompute' ? 'Recomputing…' : 'Recompute from Tests'}
          </Button>
        </div>

        {batch.notes && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Current Notes</p>
            <p className="text-sm text-slate-700">{batch.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
