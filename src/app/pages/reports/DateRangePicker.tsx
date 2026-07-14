import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPresetRange, DateRange } from './dateRangeUtils';
import { CalendarDays } from 'lucide-react';

const PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom' },
];

interface Props {
  range: DateRange;
  preset: string;
  onPresetChange: (preset: string, range: DateRange) => void;
  onRangeChange: (range: DateRange) => void;
}

export function DateRangePicker({ range, preset, onPresetChange, onRangeChange }: Props) {
  const handlePreset = (value: string) => {
    if (value === 'custom') {
      onPresetChange('custom', range);
    } else {
      const r = getPresetRange(value);
      onPresetChange(value, r);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
        <CalendarDays className="h-4 w-4" />
        Date Range:
      </div>
      <Select value={preset} onValueChange={handlePreset}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={range.from}
        onChange={e => {
          onPresetChange('custom', { ...range, from: e.target.value });
          onRangeChange({ ...range, from: e.target.value });
        }}
        className="w-36"
      />
      <span className="text-gray-400 text-sm">to</span>
      <Input
        type="date"
        value={range.to}
        onChange={e => {
          onPresetChange('custom', { ...range, to: e.target.value });
          onRangeChange({ ...range, to: e.target.value });
        }}
        className="w-36"
      />
    </div>
  );
}
