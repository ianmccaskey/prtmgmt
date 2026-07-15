import React, { useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, PaymentBadge, SourceBadges, FreeBadge, ChannelBadge } from './OrderBadges';
import { Plus, Search, Crown } from 'lucide-react';
import listOrders from '@/actions/orders/listOrders';
import updateOrderStatus from '@/actions/orders/updateOrderStatus';
import insertAuditLog from '@/actions/orders/insertAuditLog';
import { useMutateAction } from '@uibakery/data';
import { usePagination, PaginationFooter } from '@/components/Paginated';
import { NewOrderForm } from './NewOrderForm';
import { OrderDetailDrawer } from './OrderDetailDrawer';

/** Inline transitions allowed straight from the table row (rest go through flows/drawer). */
const INLINE_NEXT: Record<string, string[]> = {
  confirmed: ['in_production'],
  shipped: ['delivered'],
};

type Order = {
  id: number; order_number: string; order_date: string; status: string; payment_status: string;
  total_usd: string; is_free_order: boolean; order_channel: string;
  customer_name: string; customer_email: string; customer_phone: string; customer_handle: string;
  is_vip: boolean; is_blocked: boolean;
  has_warehouse_lines: boolean; has_china_lines: boolean; item_count: string;
  free_order_reason_label: string;
};

const STATUS_OPTIONS = ['', 'confirmed', 'in_production', 'partially_shipped', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_OPTIONS = ['', 'unpaid', 'partial_paid', 'paid', 'refunded'];
const CHANNEL_OPTIONS = ['', 'telegram', 'signal', 'discord', 'whatsapp', 'other'];

export function AllOrdersTab() {
  const { isWarehouse, profileId } = useAppUser();
  const [doUpdateStatus] = useMutateAction(updateOrderStatus);
  const [doAudit] = useMutateAction(insertAuditLog);

  const inlineStatusChange = async (order: { id: number; status: string }, next: string) => {
    const res = await doUpdateStatus({ orderId: order.id, status: next, cancellationReason: null }) as unknown[];
    if (res && res.length > 0) {
      await doAudit({ orderId: order.id, userId: profileId, changeType: 'status', fieldName: 'status', oldValue: order.status, newValue: next, note: 'Inline status update' });
    }
    reload();
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const params = {
    search: search || null, status: statusFilter || null,
    paymentStatus: paymentFilter || null, channel: channelFilter || null,
    isFreeOrder: null, dateFrom: dateFrom || null, dateTo: dateTo || null,
  };

  const [orders, loading, , reload] = useLoadAction(listOrders, [search, statusFilter, paymentFilter, channelFilter, dateFrom, dateTo], params);

  const pg = usePagination(asRows<Order>(orders));
  const openDetail = (id: number) => { setSelectedOrderId(id); setDrawerOpen(true); };

  return (
    <div className="space-y-4">
      {/* Filters — single row on desktop, stacked search + 2-col grid on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search order#, customer, email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s || 'All statuses'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Payment status" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_OPTIONS.map(s => <SelectItem key={s} value={s}>{s || 'All payments'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="Channel" /></SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c || 'All channels'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-[140px]" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-[140px] col-span-2 sm:col-span-1" />
        </div>
        {!isWarehouse && (
          <Button className="w-full sm:w-auto" onClick={() => setNewOrderOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Order
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Order #</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Payment</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Source</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Channel</th>
                <th className="text-right p-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={8} className="p-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : (orders as Order[]).length === 0 ? (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No orders found</td></tr>
              ) : (
                pg.pageRows.map(order => (
                  <tr key={order.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => openDetail(order.id)}>
                    <td className="p-3">
                      <span className="font-mono text-xs font-medium">{order.order_number}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span>{order.customer_name}</span>
                        {order.is_vip && <Crown className="h-3 w-3 text-yellow-500" />}
                        {order.is_blocked && <Badge className="bg-red-100 text-red-600 border-red-200 text-xs px-1 py-0">Blocked</Badge>}
                      </div>
                      {order.customer_handle && <p className="text-xs text-muted-foreground">{order.customer_handle}</p>}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">{new Date(order.order_date).toLocaleDateString()}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      {!isWarehouse && INLINE_NEXT[order.status] ? (
                        <Select value={order.status} onValueChange={v => v !== order.status && inlineStatusChange(order, v)}>
                          <SelectTrigger className="h-7 w-36 text-xs border-dashed">
                            <StatusBadge status={order.status} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={order.status} disabled>{order.status.replace(/_/g, ' ')}</SelectItem>
                            {INLINE_NEXT[order.status].map(n => (
                              <SelectItem key={n} value={n}>→ {n.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge status={order.status} />
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell"><PaymentBadge status={order.payment_status} /></td>
                    <td className="p-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <SourceBadges hasWarehouse={order.has_warehouse_lines} hasChina={order.has_china_lines} />
                        {order.is_free_order && <FreeBadge reason={order.free_order_reason_label} />}
                      </div>
                    </td>
                    <td className="p-3 hidden lg:table-cell"><ChannelBadge channel={order.order_channel} /></td>
                    <td className="p-3 text-right font-medium">${Number(order.total_usd).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter {...pg} />
      </div>

      <NewOrderForm open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onSaved={() => { reload(); }} />
      <OrderDetailDrawer orderId={selectedOrderId} open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelectedOrderId(null); }} onRefresh={reload} />
    </div>
  );
}
