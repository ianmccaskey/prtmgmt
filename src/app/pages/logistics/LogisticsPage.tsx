import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plane, Ship, Package, AlertTriangle, CheckCircle2, Clock, Plus, Search } from 'lucide-react';
import listInboundShipments from '@/actions/logistics/listInboundShipments';
import getShipmentStats from '@/actions/logistics/getShipmentStats';
import listFactories from '@/actions/logistics/listFactories';
import { NewShipmentDialog } from './NewShipmentDialog';

type Shipment = {
  id: number; reference_number: string; factory_name: string; mode: string;
  freight_forwarder: string; tracking_number: string; departure_date: string;
  arrival_date: string; status: string; customs_status: string;
  line_count: number; total_shipped: number; total_received: number; discrepancy_lines: number;
};
type Stats = {
  with_freight_forwarder: number; in_transit: number;
  delivered_this_month: number; discrepancies_this_month: number;
};

const STATUS_STEPS = ['pending', 'with_freight_forwarder', 'in_transit', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', with_freight_forwarder: 'With FF', in_transit: 'In Transit', delivered: 'Delivered',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  with_freight_forwarder: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function StatusPipeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, idx) => (
        <React.Fragment key={step}>
          <div
            className={`h-2 w-8 rounded-full ${idx <= currentIdx ? 'bg-blue-500' : 'bg-gray-200'}`}
            title={STATUS_LABELS[step]}
          />
          {idx < STATUS_STEPS.length - 1 && (
            <div className={`h-px w-3 ${idx < currentIdx ? 'bg-blue-500' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === 'air') return <Plane className="h-4 w-4 text-blue-500" />;
  if (mode === 'ocean') return <Ship className="h-4 w-4 text-indigo-500" />;
  return <Package className="h-4 w-4 text-gray-500" />;
}

export function LogisticsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const [shipments, shipmentsLoading] = useLoadAction(listInboundShipments, [], {
    search, status: statusFilter, factory_id: factoryFilter, mode: modeFilter,
  });
  const [stats] = useLoadAction(getShipmentStats, [], {});
  const [factories] = useLoadAction(listFactories, [], {});

  const statsRow = (stats as Stats[])?.[0] || {} as Stats;
  const shipmentsList = (shipments as Shipment[]) || [];

  const handleSearch = () => setSearch(searchVal);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics</h1>
          <p className="text-sm text-gray-500 mt-1">Inbound shipments from factories</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Inbound Shipment
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-500">With Freight Forwarder</span>
            </div>
            <div className="text-2xl font-bold">{statsRow.with_freight_forwarder ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Ship className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-gray-500">In Transit</span>
            </div>
            <div className="text-2xl font-bold">{statsRow.in_transit ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-500">Delivered This Month</span>
            </div>
            <div className="text-2xl font-bold">{statsRow.delivered_this_month ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-500">Discrepancies This Month</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{statsRow.discrepancies_this_month ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbound Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search reference, tracking, factory…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="with_freight_forwarder">With FF</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={factoryFilter || 'all'} onValueChange={v => setFactoryFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Factories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Factories</SelectItem>
                {((factories as { id: number; name: string }[]) || []).map(f => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modeFilter || 'all'} onValueChange={v => setModeFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="ocean">Ocean</SelectItem>
                <SelectItem value="express_courier">Express Courier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Factory</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Freight Forwarder</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Discrepancies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipmentsLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-400">Loading…</TableCell></TableRow>
              ) : shipmentsList.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-400">No shipments found</TableCell></TableRow>
              ) : shipmentsList.map(s => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/logistics/${s.id}`)}
                >
                  <TableCell className="font-mono font-medium text-blue-600">{s.reference_number}</TableCell>
                  <TableCell>{s.factory_name || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ModeIcon mode={s.mode} />
                      <span className="capitalize text-sm">{s.mode?.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.freight_forwarder || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{s.tracking_number || '—'}</TableCell>
                  <TableCell className="text-sm">{s.departure_date ? s.departure_date.split('T')[0] : '—'}</TableCell>
                  <TableCell className="text-sm">{s.arrival_date ? s.arrival_date.split('T')[0] : '—'}</TableCell>
                  <TableCell><StatusPipeline status={s.status} /></TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-700'}>
                      {STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{s.line_count}</TableCell>
                  <TableCell>
                    {Number(s.discrepancy_lines) > 0 ? (
                      <Badge className="bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" /> {s.discrepancy_lines}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showNewDialog && (
        <NewShipmentDialog
          open={showNewDialog}
          onClose={() => setShowNewDialog(false)}
          onCreated={(id) => navigate(`/logistics/${id}`)}
        />
      )}
    </div>
  );
}
