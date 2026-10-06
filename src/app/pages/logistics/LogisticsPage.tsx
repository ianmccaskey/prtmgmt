import React, { useMemo, useState, useEffect } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction } from '@uibakery/data';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plane, Ship, Package, PackageCheck, AlertTriangle, CheckCircle2, Clock, Plus, Search } from 'lucide-react';
import listInboundShipments from '@/actions/logistics/listInboundShipments';
import getShipmentStats from '@/actions/logistics/getShipmentStats';
import { usePagination, PaginationFooter } from '@/components/Paginated';
import listFactories from '@/actions/logistics/listFactories';
import { NewShipmentDialog, ShipmentPrefillItem } from './NewShipmentDialog';
import { carrierTrackingUrl } from '@/lib/shippo';

type Shipment = {
  id: number; reference_number: string; factory_name: string; mode: string;
  freight_forwarder: string; tracking_number: string; departure_date: string;
  arrival_date: string; status: string; customs_status: string;
  carrier: string | null; tracking_status: string | null; tracking_details: string | null;
  tracking_eta: string | null; tracking_checked_at: string | null;
  line_count: number; total_shipped: number; total_received: number; discrepancy_lines: number;
};
type Stats = {
  with_freight_forwarder: number; in_transit: number;
  delivered_this_month: number; discrepancies_this_month: number;
};

// Must match the shipments_inbound.status CHECK constraint.
const STATUS_LABELS: Record<string, string> = {
  freight_forwarder: 'With FF', in_transit: 'In Transit', delivered: 'Delivered',
};
const STATUS_COLORS: Record<string, string> = {
  freight_forwarder: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
};

// Shippo tracking statuses → friendly labels (statuses per lib/shippo.ts).
const TRACK_LABELS: Record<string, string> = {
  PRE_TRANSIT: 'Pre-transit', TRANSIT: 'In transit', DELIVERED: 'Delivered',
  RETURNED: 'Returned', FAILURE: 'Failed', UNKNOWN: 'Unknown',
};
const trackLabel = (s: string) => TRACK_LABELS[s] || s;
// tracking_eta is a real timestamptz (a moment, not a date-only column),
// so local-date formatting is correct here.
const fmtEta = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
// Short display for DATE columns, read straight off the string (no timezone
// conversion — fmtDate doctrine) and matching the ETA's "Oct 2" style.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(v: string | null): string {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : '—';
}

/** Carrier says delivered but the warehouse hasn't received it — act today. */
const arrivedAwaiting = (s: Shipment) => s.tracking_status === 'DELIVERED' && s.status !== 'delivered';

function ModeIcon({ mode }: { mode: string }) {
  const label = mode?.replace('_', ' ') || '';
  if (mode === 'air') return <Plane className="h-4 w-4 text-blue-500 shrink-0" aria-label={label} />;
  if (mode === 'ocean') return <Ship className="h-4 w-4 text-indigo-500 shrink-0" aria-label={label} />;
  return <Package className="h-4 w-4 text-gray-400 shrink-0" aria-label={label} />;
}

export function LogisticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Reorder quick-action lands here with pre-populated line items. Capture
  // once, then scrub the history entry so back-navigation doesn't reopen a
  // stale prefilled dialog.
  const [prefillItems] = useState<ShipmentPrefillItem[] | undefined>(
    () => (location.state as { prefillItems?: ShipmentPrefillItem[] } | null)?.prefillItems
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  // Month-labeled stat cards filter EXACTLY what they count (status +
  // arrival in the current month, mirroring getShipmentStats). Client-side:
  // the rows arrive unpaginated, so no action round-trip is needed.
  const [cardScope, setCardScope] = useState<'' | 'delivered_month' | 'disc_month'>('');
  const [searchVal, setSearchVal] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(!!prefillItems?.length);

  useEffect(() => {
    if ((location.state as { prefillItems?: unknown } | null)?.prefillItems) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shipments, shipmentsLoading] = useLoadAction(listInboundShipments, [], {
    search, status: statusFilter, factory_id: factoryFilter, mode: modeFilter,
  });
  const [stats] = useLoadAction(getShipmentStats, [], {});
  const [factories] = useLoadAction(listFactories, [], {});

  const statsRow = (stats as Stats[])?.[0] || {} as Stats;
  // Current calendar month as "YYYY-MM" for arrival_date string comparison
  // (DATE column — compared off the string, matching getShipmentStats'
  // date_trunc('month', CURRENT_DATE) predicate).
  const curMonth = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  })();
  const inThisMonth = (d: string | null) => String(d ?? '').slice(0, 7) === curMonth;
  const shipmentsList = useMemo(() => {
    const all = asRows<Shipment>(shipments);
    if (cardScope === 'delivered_month') return all.filter(s => s.status === 'delivered' && inThisMonth(s.arrival_date));
    if (cardScope === 'disc_month') return all.filter(s => Number(s.discrepancy_lines) > 0 && inThisMonth(s.arrival_date));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, cardScope]);
  const pgShip = usePagination(shipmentsList);

  const handleSearch = () => setSearch(searchVal);
  const anyFilter = !!(search || statusFilter || factoryFilter || modeFilter || cardScope);
  const clearFilters = () => {
    setSearch(''); setSearchVal(''); setStatusFilter(''); setFactoryFilter(''); setModeFilter(''); setCardScope('');
  };
  // Stat cards filter the table below; clicking the active one clears it.
  // Status cards use the server filter; month cards use the client scope.
  const toggleStatus = (v: string) => { setCardScope(''); setStatusFilter(f => (f === v ? '' : v)); };
  const toggleScope = (v: 'delivered_month' | 'disc_month') => { setStatusFilter(''); setCardScope(s => (s === v ? '' : v)); };

  const statCard = (
    icon: React.ReactNode, label: string, value: React.ReactNode, active: boolean, onClick: () => void,
  ) => (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className={`cursor-pointer transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none ${active ? 'ring-2 ring-blue-400' : ''}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      title={active ? 'Click to clear this filter' : 'Click to filter the list'}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics</h1>
          <p className="text-sm text-gray-500 mt-1">Inbound shipments from factories</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Inbound Shipment
        </Button>
      </div>

      {/* Stat cards double as one-click filters (same contract as the dashboard cards). */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard(
          <Package className="h-4 w-4 text-blue-500" />, 'With Freight Forwarder',
          statsRow.with_freight_forwarder ?? 0,
          statusFilter === 'freight_forwarder', () => toggleStatus('freight_forwarder'),
        )}
        {statCard(
          <Ship className="h-4 w-4 text-amber-500" />, 'In Transit',
          statsRow.in_transit ?? 0,
          statusFilter === 'in_transit', () => toggleStatus('in_transit'),
        )}
        {statCard(
          <CheckCircle2 className="h-4 w-4 text-green-500" />, 'Delivered This Month',
          statsRow.delivered_this_month ?? 0,
          cardScope === 'delivered_month', () => toggleScope('delivered_month'),
        )}
        {statCard(
          <AlertTriangle className="h-4 w-4 text-red-500" />, 'Discrepancies This Month',
          <span className="text-red-600">{statsRow.discrepancies_this_month ?? 0}</span>,
          cardScope === 'disc_month', () => toggleScope('disc_month'),
        )}
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
              <Button variant="outline" size="icon" onClick={handleSearch} aria-label="Search shipments">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={statusFilter || 'all'}
              onValueChange={v => {
                // A month-card scope + a conflicting status filter would
                // guarantee an empty table — the dropdown wins, scope clears.
                setCardScope('');
                setStatusFilter(v === 'all' ? '' : v);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="freight_forwarder">With FF</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Select value={factoryFilter || 'all'} onValueChange={v => setFactoryFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Factories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Factories</SelectItem>
                {asRows<{ id: number; name: string }>(factories).map(f => (
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
                <TableHead>Tracking</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Lines</TableHead>
                <TableHead>Discrepancies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipmentsLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Loading…</TableCell></TableRow>
              ) : shipmentsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    {anyFilter ? (
                      <span>
                        No shipments match these filters.{' '}
                        <button type="button" className="text-blue-600 underline" onClick={clearFilters}>Clear filters</button>
                      </span>
                    ) : 'No inbound shipments yet — create one with New Inbound Shipment.'}
                  </TableCell>
                </TableRow>
              ) : pgShip.pageRows.map(s => (
                <TableRow
                  key={s.id}
                  className={`cursor-pointer ${arrivedAwaiting(s) ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate(`/logistics/${s.id}`)}
                >
                  <TableCell className="font-medium text-blue-600">
                    <div className="flex items-center gap-1.5">
                      <ModeIcon mode={s.mode} />
                      <span className="font-mono">{s.reference_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.factory_name || '—'}</div>
                    {s.freight_forwarder && <div className="text-xs text-gray-500">{s.freight_forwarder}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      const num = dbText(s.tracking_number);
                      if (!num) return '—';
                      const url = carrierTrackingUrl(s.carrier, num);
                      return (
                        <div className="space-y-0.5">
                          {url ? (
                            <a
                              href={url} target="_blank" rel="noreferrer"
                              className="font-mono text-blue-600 underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {num}
                            </a>
                          ) : <span className="font-mono">{num}</span>}
                          {s.tracking_status && s.status !== 'delivered' && !arrivedAwaiting(s) && (
                            <p className="text-gray-500" title={s.tracking_details || undefined}>
                              {trackLabel(s.tracking_status)}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.arrival_date
                      ? fmtDay(s.arrival_date)
                      : s.tracking_eta && s.status !== 'delivered'
                        ? <span className="text-amber-700 flex items-center gap-1"><Clock className="h-3 w-3" /> ETA {fmtEta(s.tracking_eta)}</span>
                        : '—'}
                  </TableCell>
                  <TableCell>
                    {arrivedAwaiting(s) ? (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
                        <PackageCheck className="h-3 w-3" /> Arrived — receive
                      </Badge>
                    ) : (
                      <Badge className={STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-700'}>
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    )}
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
          <PaginationFooter {...pgShip} />
        </CardContent>
      </Card>

      {showNewDialog && (
        <NewShipmentDialog
          open={showNewDialog}
          onClose={() => setShowNewDialog(false)}
          onCreated={(id) => navigate(`/logistics/${id}`)}
          prefillItems={prefillItems}
        />
      )}
    </div>
  );
}
