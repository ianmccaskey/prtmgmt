import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Send, AlertCircle } from 'lucide-react';
import getRefundTasks from '@/actions/orders/getRefundTasks';
import getRefundStats from '@/actions/orders/getRefundStats';
import markRefundSent from '@/actions/orders/markRefundSent';
import markRefundVerified from '@/actions/orders/markRefundVerified';

type RefundTask = {
  id: number; order_number: string; customer_name: string;
  amount_usd_owed: string; reason: string; assignee_name: string;
  due_date: string; status: string; days_overdue: number;
  sent_at: string; verified_at: string; linked_payment_id: number | null;
};

type Stats = { owed_count: string; owed_usd: string; overdue_count: string; sent_this_week: string; verified_this_week: string };

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col px-4 py-2 border-r border-border/60 last:border-0 ${highlight ? 'bg-red-50' : ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-red-600' : ''}`}>{value ?? '0'}</span>
    </div>
  );
}

const ASSETS = ['USDC', 'USDT', 'ETH', 'SOL', 'BTC'];
const NETWORKS: Record<string, string[]> = {
  USDC: ['ETH', 'SOL'], USDT: ['ETH', 'SOL'], ETH: ['ETH'], SOL: ['SOL'], BTC: ['BTC'],
};

function MarkSentDrawer({ task, open, onClose, onDone }: { task: RefundTask | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const [asset, setAsset] = useState('USDC');
  const [network, setNetwork] = useState('ETH');
  const [spot, setSpot] = useState('');
  const [amountAssetStr, setAmountAssetStr] = useState('');
  const [txHash, setTxHash] = useState('');
  const [doSend, sending] = useMutateAction(markRefundSent);

  const amountUsd = task ? Number(task.amount_usd_owed) : 0;
  const computedAmountAsset = spot && Number(spot) > 0 ? (amountUsd / Number(spot)).toFixed(6) : '';

  const submit = async () => {
    if (!task) return;
    await doSend({ taskId: task.id, asset, network, spotRateUsd: Number(spot), amountAsset: Number(amountAssetStr || computedAmountAsset), amountUsd, txHash });
    onDone(); onClose();
    setAsset('USDC'); setNetwork('ETH'); setSpot(''); setAmountAssetStr(''); setTxHash('');
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-6" side="right">
        <SheetHeader className="mb-4">
          <SheetTitle>Mark Refund Sent</SheetTitle>
          {task && (
            <div className="text-sm space-y-1">
              <p>Order: <span className="font-medium">{task.order_number}</span></p>
              <p>Customer: <span className="font-medium">{task.customer_name}</span></p>
              <p className="text-lg font-bold">${Number(task.amount_usd_owed).toFixed(2)} owed</p>
            </div>
          )}
        </SheetHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Asset</Label>
              <Select value={asset} onValueChange={v => { setAsset(v); setNetwork(NETWORKS[v]?.[0] || ''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(NETWORKS[asset] || []).map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Spot Rate (USD per {asset})</Label>
            <div className="flex gap-2 items-center">
              <Input type="number" min={0} step={0.01} value={spot} onChange={e => setSpot(e.target.value)} />
              {computedAmountAsset && <span className="text-sm text-muted-foreground whitespace-nowrap">= {computedAmountAsset} {asset}</span>}
            </div>
          </div>
          <div>
            <Label>Amount ({asset}) — override if different</Label>
            <Input type="number" min={0} step={0.000001} value={amountAssetStr || computedAmountAsset} onChange={e => setAmountAssetStr(e.target.value)} />
          </div>
          <div>
            <Label>TX Hash</Label>
            <Input placeholder="0x…" value={txHash} onChange={e => setTxHash(e.target.value)} />
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={sending || !spot || !txHash}>
            <Send className="h-4 w-4 mr-1" /> Mark Sent
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function dueDateClass(task: RefundTask): string {
  if (task.status !== 'owed') return '';
  const days = Number(task.days_overdue);
  if (days > 0) return 'text-red-600 font-semibold';
  if (days > -3) return 'text-amber-600';
  return 'text-green-600';
}

const STATUS_OPTIONS = ['', 'owed', 'sent', 'verified'];

export function RefundsTab() {
  const { profileId } = useAppUser();
  const [statusFilter, setStatusFilter] = useState('owed');
  const [tasks, loading, , reload] = useLoadAction(getRefundTasks, [statusFilter], { status: statusFilter || null });
  const [stats] = useLoadAction(getRefundStats, []);
  const [selectedTask, setSelectedTask] = useState<RefundTask | null>(null);
  const [sentOpen, setSentOpen] = useState(false);
  const [doVerify, verifying] = useMutateAction(markRefundVerified);

  const statRow = (stats as Stats[])[0];

  const handleVerify = async (task: RefundTask) => {
    await doVerify({ taskId: task.id, userId: profileId });
    reload();
  };

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="flex items-center bg-muted/30 border border-border/60 rounded-lg overflow-x-auto">
        <StatChip label="Owed Count" value={statRow?.owed_count ?? '0'} />
        <StatChip label="Owed (USD)" value={`$${Number(statRow?.owed_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <StatChip label="Overdue" value={statRow?.overdue_count ?? '0'} highlight={Number(statRow?.overdue_count) > 0} />
        <StatChip label="Sent This Week" value={statRow?.sent_this_week ?? '0'} />
        <StatChip label="Verified This Week" value={statRow?.verified_this_week ?? '0'} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s || 'All statuses'}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Order #</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-right p-3 font-medium">Owed (USD)</th>
                <th className="text-left p-3 font-medium">Reason</th>
                <th className="text-left p-3 font-medium">Assignee</th>
                <th className="text-left p-3 font-medium">Due Date</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="p-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : (tasks as RefundTask[]).length === 0 ? (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No refund tasks found</td></tr>
              ) : (
                asRows<RefundTask>(tasks).map(task => (
                  <tr key={task.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-medium">{task.order_number}</td>
                    <td className="p-3">{task.customer_name}</td>
                    <td className="p-3 text-right font-semibold">${Number(task.amount_usd_owed).toFixed(2)}</td>
                    <td className="p-3 max-w-[180px] truncate text-muted-foreground" title={task.reason}>{task.reason}</td>
                    <td className="p-3 text-muted-foreground">{task.assignee_name || '—'}</td>
                    <td className={`p-3 text-xs ${dueDateClass(task)}`}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                      {task.status === 'owed' && Number(task.days_overdue) > 0 && <span className="ml-1">({task.days_overdue}d overdue)</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs px-1 py-0 ${task.status === 'owed' ? 'bg-red-50 text-red-700 border-red-200' : task.status === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {task.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {task.status === 'owed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedTask(task); setSentOpen(true); }}>
                            <Send className="h-3 w-3 mr-1" /> Mark Sent
                          </Button>
                        )}
                        {task.status === 'sent' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => handleVerify(task)} disabled={verifying}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Verified
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MarkSentDrawer task={selectedTask} open={sentOpen} onClose={() => { setSentOpen(false); setSelectedTask(null); }} onDone={reload} />
    </div>
  );
}
