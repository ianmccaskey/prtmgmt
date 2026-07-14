import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import listBatchTestsByProductAction from '@/actions/batches/listBatchTestsByProduct';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type TestResult = {
  id: number; batch_id: number; test_type: string; test_date: string; lab_name: string;
  result_value: number; result_units: string; spec_min: number; spec_max: number;
  pass_fail: string; test_report_url: string; notes: string;
  batch_number: string; manufacture_date: string;
};

const TEST_TYPES: { value: string; label: string }[] = [
  { value: 'mass_spec', label: 'Mass / ID (Mass Spec)' },
  { value: 'hplc_purity', label: 'Purity (HPLC)' },
  { value: 'endotoxin', label: 'Endotoxin' },
  { value: 'sterility', label: 'Sterility (TAMC/TYMC)' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'moisture', label: 'Moisture' },
  { value: 'other', label: 'Other' },
];
const TEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(TEST_TYPES.map(t => [t.value, t.label]));

export function ProductTestResultsTab({ productId }: { productId: number }) {
  const [testType, setTestType] = useState('');
  const [tests, loading] = useLoadAction(listBatchTestsByProductAction, [], { product_id: productId, test_type: testType });
  const rows: TestResult[] = Array.isArray(tests) ? tests : [];

  // Build HPLC purity chart (line chart of result_value by batch manufacture_date)
  const hplcData = rows
    .filter(r => r.test_type === 'hplc_purity')
    .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime())
    .map(r => ({
      batch: r.batch_number,
      purity: Number(r.result_value),
      spec_min: Number(r.spec_min),
    }));

  return (
    <div className="space-y-4">
      {hplcData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">HPLC Purity by Batch</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hplcData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="batch" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="purity" name="Purity %" stroke="#3b82f6" strokeWidth={2} dot />
                <Line type="monotone" dataKey="spec_min" name="Spec Min" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Test Results</CardTitle>
            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All test types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {TEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Batch</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Test Type</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Lab</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Result</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Spec Range</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">P/F</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Report</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-sm">{r.batch_number}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{TEST_TYPE_LABEL[r.test_type] || r.test_type}</Badge></td>
                    <td className="px-4 py-2 text-slate-600">{r.test_date ? new Date(r.test_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.lab_name || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">{r.result_value != null ? `${r.result_value} ${r.result_units || ''}` : (r.notes || '—')}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{r.spec_min != null ? `${r.spec_min}` : ''}–{r.spec_max != null ? `${r.spec_max}` : ''} {r.result_units}</td>
                    <td className="px-4 py-2">
                      <Badge className={`text-xs ${r.pass_fail === 'pass' ? 'bg-green-100 text-green-700' : r.pass_fail === 'fail' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.pass_fail || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {r.test_report_url ? <a href={r.test_report_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline"><ExternalLink className="h-3 w-3" /></a> : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-400">No test results</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
