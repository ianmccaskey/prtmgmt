import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import updateBatchQcStatusAction from '@/actions/batches/updateBatchQcStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

type Batch = { id: number; qc_status: string; notes: string };

export function BatchQcPanel({ batch, onRefresh }: { batch: Batch; onRefresh: () => void }) {
  const [updateQc] = useMutateAction(updateBatchQcStatusAction);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const handleAction = async (status: string) => {
    if ((status === 'quarantined') && !note.trim()) {
      alert('A note is required to send to quarantine.');
      return;
    }
    setSaving(status);
    await updateQc({ id: batch.id, qc_status: status, notes: note || null });
    setNote('');
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
            batch.qc_status === 'quarantined' ? 'bg-orange-100 text-orange-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>{batch.qc_status}</span>
        </div>

        <div>
          <Label>Note (required for quarantine)</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason or notes for this QC action…" rows={2} className="mt-1" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
            disabled={batch.qc_status === 'passed' || saving !== null}
            onClick={() => handleAction('passed')}
          >
            <ShieldCheck className="h-4 w-4 mr-1" />{saving === 'passed' ? 'Updating…' : 'Mark Passed'}
          </Button>
          <Button
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            disabled={batch.qc_status === 'quarantined' || saving !== null}
            onClick={() => handleAction('quarantined')}
          >
            <ShieldAlert className="h-4 w-4 mr-1" />{saving === 'quarantined' ? 'Updating…' : 'Send to Quarantine'}
          </Button>
          <Button
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            disabled={batch.qc_status === 'pending' || saving !== null}
            onClick={() => handleAction('pending')}
          >
            <Shield className="h-4 w-4 mr-1" />{saving === 'pending' ? 'Updating…' : 'Reset to Pending'}
          </Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
            disabled={batch.qc_status === 'failed' || saving !== null}
            onClick={() => handleAction('failed')}
          >
            <ShieldX className="h-4 w-4 mr-1" />{saving === 'failed' ? 'Updating…' : 'Mark Failed'}
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
