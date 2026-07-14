import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Crown, Ban, Search, Plus, Download } from 'lucide-react';
import listCustomers from '@/actions/customers/listCustomers';
import { usePagination, PaginationFooter } from '@/components/Paginated';
import { NewCustomerDialog } from './NewCustomerDialog';

type Customer = {
  id: number; full_name: string; email: string; phone: string;
  preferred_channel: string; channel_handle: string;
  is_vip: boolean; is_blocked: boolean; blocked_reason: string;
  total_orders: string; lifetime_value: string; last_order_date: string;
};

const CHANNELS = ['', 'telegram', 'signal', 'discord', 'whatsapp', 'other'];

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [isVip, setIsVip] = useState('');
  const [isBlocked, setIsBlocked] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const params = {
    search: search || null,
    channel: channel || null,
    isVip: isVip === 'true' ? true : isVip === 'false' ? false : null,
    isBlocked: isBlocked === 'true' ? true : isBlocked === 'false' ? false : null,
  };

  const [customers, loading, , reload] = useLoadAction(listCustomers, [search, channel, isVip, isBlocked], params);
  const pgCust = usePagination((customers as Customer[]) || []);

  const exportCSV = () => {
    const rows = customers as Customer[];
    const header = 'Name,Email,Phone,Channel,Handle,VIP,Blocked,Total Orders,Lifetime Value,Last Order';
    const lines = rows.map(c =>
      [c.full_name, c.email, c.phone, c.preferred_channel, c.channel_handle,
       c.is_vip ? 'Yes' : 'No', c.is_blocked ? 'Yes' : 'No',
       c.total_orders, Number(c.lifetime_value).toFixed(2), c.last_order_date || ''].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">Customer database with VIP status, interaction logs, and order history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, phone, handle…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All channels" /></SelectTrigger>
          <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c || 'All channels'}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={isVip} onValueChange={setIsVip}>
          <SelectTrigger className="w-[110px]"><SelectValue placeholder="VIP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="true">VIP only</SelectItem>
            <SelectItem value="false">Non-VIP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={isBlocked} onValueChange={setIsBlocked}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="true">Blocked only</SelectItem>
            <SelectItem value="false">Active only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Channel</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-right p-3 font-medium">Orders</th>
                <th className="text-right p-3 font-medium">Lifetime Value</th>
                <th className="text-left p-3 font-medium">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="p-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : (customers as Customer[]).length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No customers found</td></tr>
              ) : (
                pgCust.pageRows.map(c => (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{c.full_name}</span>
                        {c.is_vip && (
                          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-1 py-0">
                            <Crown className="h-3 w-3 mr-0.5 inline" />VIP
                          </Badge>
                        )}
                        {c.is_blocked && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-1 py-0 cursor-help">
                                  <Ban className="h-3 w-3 mr-0.5 inline" />Blocked
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs max-w-[200px]">{c.blocked_reason || 'No reason given'}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {c.preferred_channel && (
                        <div>
                          <span className="capitalize text-xs font-medium">{c.preferred_channel}</span>
                          {c.channel_handle && <span className="text-xs text-muted-foreground ml-1">{c.channel_handle}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{c.email || '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.phone || '—'}</td>
                    <td className="p-3 text-right">{c.total_orders}</td>
                    <td className="p-3 text-right font-medium">${Number(c.lifetime_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter {...pgCust} />
      </div>

      <NewCustomerDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={c => { setNewOpen(false); navigate(`/customers/${c.id}`); }} />
    </div>
  );
}
