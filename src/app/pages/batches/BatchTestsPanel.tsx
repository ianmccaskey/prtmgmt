import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import listBatchTestsAction from '@/actions/batches/listBatchTests';
import createBatchTestsBulkAction from '@/actions/batches/createBatchTestsBulk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ExternalLink } from 'lucide-react';

type Test = {
  id: number; test_type: string; test_date: string; lab_name: string;
  result_value: number; result_units: string; spec_min: number; spec_max: number;
  pass_fail: string; test_report_url: string; notes: string;
};

// DB check constraint: test_type IN ('hplc_purity','mass_spec','endotoxin','sterility','appearance','moisture','other')
const TEST_TYPES: { value: string; label: string; defaultUnits: string }[] = [
  { value: 'mass_spec', label: 'Mass / ID (Mass Spec)', defaultUnits: 'mg' },
  { value: 'hplc_purity', label: 'Purity (HPLC)', defaultUnits: '%' },
  { value: 'endotoxin', label: 'Endotoxin', defaultUnits: 'EU/vial' },
  { value: 'sterility', label: 'Sterility (TAMC/TYMC)', defaultUnits: '' },
  { value: 'appearance', label: 'Appearance', defaultUnits: '' },
  { value: 'moisture', label: 'Moisture', defaultUnits: '%' },
  { value: 'other', label: 'Other', defaultUnits: '' },
];

const TEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(TEST_TYPES.map(t => [t.value, t.label]));

type RowForm = {
  enabled: boolean;
  test_type: string;
  identity: string; // e.g. peptide name for Mass/ID row, or TAMC/TYMC free text for sterility
  result_value: string;
  result_units: string;
  spec_min: string;
  spec_max: string;
  pass_fail: string;
  notes: string;
};

function emptyRows(): RowForm[] {
  return TEST_TYPES.map(t => ({
    enabled: false,
    test_type: t.value,
    identity: '',
    result_value: '',
    result_units: t.defaultUnits,
    spec_min: '',
    spec_max: '',
    pass_fail: 'pass',
    notes: '',
  }));
}

export function BatchTestsPanel({ batchId }: { batchId: number }) {
  const [filterType, setFilterType] = useState('');
  const [tests, loading, , reload] = useLoadAction(listBatchTestsAction, [], { batch_id: batchId, test_type: filterType });
  const [createTestsBulk] = useMutateAction(createBatchTestsBulkAction);
  const rows: Test[] = Array.isArray(tests) ? tests : [];

  const [showNew, setShowNew] = useState(false);
  const [testDate, setTestDate] = useState('');
  const [labName, setLabName] = useState('');
  const [testReportUrl, setTestReportUrl] = useState('');
  const [formRows, setFormRows] = useState<RowForm[]>(emptyRows());
  const [saving, setSaving] = useState(false);

  const setRow = (idx: number, patch: Partial<RowForm>) => {
    setFormRows(fr => fr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const resetForm = () => {
    setTestDate('');
    setLabName('');
    setTestReportUrl('');
    setFormRows(emptyRows());
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const active = formRows.filter(r => r.enabled);
    if (active.length === 0) return;
    setSaving(true);
    const payload = active.map(r => {
      const notes = r.test_type === 'sterility' || r.test_type === 'mass_spec'
        ? [r.identity, r.notes].filter(Boolean).join(' — ') || null
        : (r.notes || null);
      return {
        test_type: r.test_type,
        test_date: testDate || null,
        lab_name: labName || null,
        result_value: r.result_value ? parseFloat(r.result_value) : null,
        result_units: r.result_units || null,
        spec_min: r.spec_min ? parseFloat(r.spec_min) : null,
        spec_max: r.spec_max ? parseFloat(r.spec_max) : null,
        pass_fail: r.pass_fail || null,
        test_report_url: testReportUrl || null,
        notes,
      };
    });
    await createTestsBulk({ batch_id: batchId, rows: JSON.stringify(payload) });
    setSaving(false);
    setShowNew(false);
    resetForm();
    await reload();
  };

  // Latest result per test type
  const latestByType = TEST_TYPES.map(({ value, label }) => {
    const matching = rows.filter(r => r.test_type === value);
    return matching.length > 0 ? { type: value, label, latest: matching[0] } : null;
  }).filter(Boolean) as { type: string; label: string; latest: Test }[];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {latestByType.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {latestByType.map(({ type, label, latest }) => (
            <Card key={type} className="p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">
                {latest.result_value != null ? `${latest.result_value} ${latest.result_units || ''}` : (latest.notes || '—')}
              </p>
              <div className="flex items-center justify-between mt-1">
                <Badge className={`text-xs ${latest.pass_fail === 'pass' ? 'bg-green-100 text-green-700' : latest.pass_fail === 'fail' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{latest.pass_fail || '—'}</Badge>
                <span className="text-xs text-slate-400">{latest.lab_name}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Test Results</CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {TEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowNew(true); }}><Plus className="h-3 w-3 mr-1" />Add Results</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Lab</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Result</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Spec</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">P/F</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Notes</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Report</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{TEST_TYPE_LABEL[r.test_type] || r.test_type}</Badge></td>
                    <td className="px-4 py-2 text-slate-600">{r.test_date ? new Date(r.test_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.lab_name || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">{r.result_value != null ? `${r.result_value} ${r.result_units || ''}` : '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{r.spec_min != null || r.spec_max != null ? `${r.spec_min ?? ''}–${r.spec_max ?? ''} ${r.result_units || ''}` : '—'}</td>
                    <td className="px-4 py-2">
                      <Badge className={`text-xs ${r.pass_fail === 'pass' ? 'bg-green-100 text-green-700' : r.pass_fail === 'fail' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{r.pass_fail || '—'}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate" title={r.notes || ''}>{r.notes || '—'}</td>
                    <td className="px-4 py-2">
                      {r.test_report_url ? <a href={r.test_report_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline"><ExternalLink className="h-3 w-3" /></a> : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-400">No test results yet</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={v => !v && setShowNew(false)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Test Results</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveAll} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Test Date</Label><Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} /></div>
              <div><Label>Lab Name</Label><Input value={labName} onChange={e => setLabName(e.target.value)} placeholder="e.g. Janoshik Analytical" /></div>
              <div><Label>Test Report URL</Label><Input type="url" placeholder="https://…" value={testReportUrl} onChange={e => setTestReportUrl(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500">Check each result you want to record, then fill in its values.</p>
              {formRows.map((r, idx) => {
                const meta = TEST_TYPES[idx];
                const isCompound = r.test_type === 'sterility';
                const isIdRow = r.test_type === 'mass_spec';
                return (
                  <div key={meta.value} className={`border rounded-md p-3 ${r.enabled ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={r.enabled} onChange={e => setRow(idx, { enabled: e.target.checked })} />
                      <span className="font-medium text-sm text-slate-700">{meta.label}</span>
                    </label>
                    {r.enabled && (
                      <div className="mt-2 grid grid-cols-12 gap-2 items-end">
                        {isIdRow && (
                          <div className="col-span-4">
                            <Label className="text-xs">Identity (e.g. Tirzepatide)</Label>
                            <Input value={r.identity} onChange={e => setRow(idx, { identity: e.target.value })} placeholder="Tirzepatide" />
                          </div>
                        )}
                        {isCompound ? (
                          <div className="col-span-8">
                            <Label className="text-xs">Result (e.g. TAMC/Pass; TYMC Pass)</Label>
                            <Input value={r.identity} onChange={e => setRow(idx, { identity: e.target.value })} placeholder="TAMC/Pass; TYMC Pass" />
                          </div>
                        ) : (
                          <>
                            <div className="col-span-3">
                              <Label className="text-xs">Value</Label>
                              <Input type="number" step="0.001" value={r.result_value} onChange={e => setRow(idx, { result_value: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Units</Label>
                              <Input value={r.result_units} onChange={e => setRow(idx, { result_units: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Spec Min</Label>
                              <Input type="number" step="0.001" value={r.spec_min} onChange={e => setRow(idx, { spec_min: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Spec Max</Label>
                              <Input type="number" step="0.001" value={r.spec_max} onChange={e => setRow(idx, { spec_max: e.target.value })} />
                            </div>
                          </>
                        )}
                        <div className="col-span-3">
                          <Label className="text-xs">Pass/Fail</Label>
                          <Select value={r.pass_fail} onValueChange={v => setRow(idx, { pass_fail: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass">Pass</SelectItem>
                              <SelectItem value="fail">Fail</SelectItem>
                              <SelectItem value="marginal">Marginal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className={isCompound || isIdRow ? 'col-span-9' : 'col-span-12'}>
                          <Label className="text-xs">Notes</Label>
                          <Input value={r.notes} onChange={e => setRow(idx, { notes: e.target.value })} placeholder="optional" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || formRows.every(r => !r.enabled)}>{saving ? 'Saving…' : 'Save All Results'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
