import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Truck,
  DollarSign,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  Warehouse,
  Globe,
  ArrowRight,
  Users,
  FlaskConical,
  BarChart3,
  Settings,
  HandCoins,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import getDashboardStats from '@/actions/dashboardStats';
import getRevenueByMonth from '@/actions/revenueByMonth';
import getOrderStatusBreakdown from '@/actions/orderStatusBreakdown';
import getOrdersByChannel from '@/actions/ordersByChannel';
import getRecentActivity from '@/actions/recentActivity';
import { useAppUser } from '@/app/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type StatsRow = {
  open_orders: string;
  shipped_this_month: string;
  revenue_this_month: string;
  inbound_in_transit: string;
  low_stock_alerts: string;
  unpaid_balance_usd: string;
  unverified_payments: string;
  payments_with_issues: string;
  refunds_owed_count: string;
  refunds_owed_usd: string;
  overdue_refunds: string;
  outbound_issues: string;
  warehouse_payables_usd: string;
  china_direct_awaiting: string;
};

type RevenueRow = {
  month_label: string;
  warehouse_revenue: string;
  china_revenue: string;
  total_revenue: string;
};

type StatusRow = { status: string; count: string };
type ChannelRow = { channel: string; count: string };
type ActivityRow = {
  record_type: string;
  record_id: string;
  reference: string;
  customer_name: string;
  status: string;
  amount_usd: string;
  event_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3b82f6',
  in_production: '#f59e0b',
  partially_shipped: '#f97316',
  shipped: '#10b981',
  delivered: '#059669',
  cancelled: '#ef4444',
};

const CHANNEL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#6b7280'];

function fmt(val: string | undefined, prefix = ''): string {
  if (val === undefined || val === null) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtUSD(val: string | undefined): string {
  if (val === undefined || val === null) return '$0';
  const n = parseFloat(val);
  if (isNaN(n)) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  alert,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start gap-3 p-4">
      <div className={`mt-0.5 rounded p-1.5 ${alert ? 'bg-red-50 text-red-500' : 'bg-muted text-muted-foreground'}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className={`text-lg font-semibold leading-tight mt-0.5 ${alert ? 'text-red-600' : 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <Card className="shadow-xs hover:shadow-sm transition-shadow">
      {href ? <Link to={href}>{inner}</Link> : inner}
    </Card>
  );
}

const QUICK_LINKS = [
  { label: 'Sales Orders', href: '/orders', icon: ShoppingCart, desc: 'Manage and create orders' },
  { label: 'Customers', href: '/customers', icon: Users, desc: 'Customer database', roles: ['admin', 'sales_rep'] },
  { label: 'Products', href: '/products', icon: Package, desc: 'Peptide catalog' },
  { label: 'Batches', href: '/batches', icon: FlaskConical, desc: 'QC & batch tracking' },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse, desc: 'Inventory & fulfillment' },
  { label: 'Logistics', href: '/logistics', icon: Truck, desc: 'Inbound shipments' },
  { label: 'Reports', href: '/reports', icon: BarChart3, desc: 'Analytics & exports' },
  { label: 'Commissions', href: '/commissions', icon: HandCoins, desc: 'Rep & warehouse payouts', roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, desc: 'System configuration', roles: ['admin'] },
] as { label: string; href: string; icon: React.ComponentType<{ className?: string }>; desc: string; roles?: string[] }[];

function ActivityIcon({ type }: { type: string }) {
  if (type === 'order') return <ShoppingCart className="w-3.5 h-3.5" />;
  if (type === 'shipment_out') return <Truck className="w-3.5 h-3.5" />;
  return <Package className="w-3.5 h-3.5" />;
}

function ActivityTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    order: 'Order',
    shipment_out: 'Shipped',
    shipment_in: 'Inbound',
  };
  return (
    <Badge variant="secondary" className="text-xs px-1.5 py-0">
      {labels[type] || type}
    </Badge>
  );
}

export function HomePage() {
  const { role, isWarehouse } = useAppUser();
  const [statsRaw, statsLoading] = useLoadAction(getDashboardStats, []);
  const [revenueRaw, revenueLoading] = useLoadAction(getRevenueByMonth, [], {}, { enabled: !isWarehouse });
  const [statusRaw] = useLoadAction(getOrderStatusBreakdown, []);
  const [channelRaw] = useLoadAction(getOrdersByChannel, []);
  const [activityRaw, activityLoading] = useLoadAction(getRecentActivity, []);

  const stats: StatsRow = (statsRaw as StatsRow[])[0] ?? {} as StatsRow;
  const revenue = (revenueRaw as RevenueRow[]).map(r => ({
    month: r.month_label,
    warehouse: parseFloat(r.warehouse_revenue) || 0,
    china: parseFloat(r.china_revenue) || 0,
    total: parseFloat(r.total_revenue) || 0,
  }));
  const statusData = (statusRaw as StatusRow[]).map(r => ({
    name: r.status,
    value: parseInt(r.count) || 0,
  }));
  const channelData = (channelRaw as ChannelRow[]).map(r => ({
    name: r.channel,
    value: parseInt(r.count) || 0,
  }));
  const activity = activityRaw as ActivityRow[];

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Peptide business operations dashboard</p>
      </div>

      {/* Stat Cards Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          {Array.from({ length: 13 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-3">
          <StatCard label="Open Orders" value={fmt(stats.open_orders)} icon={ShoppingCart} href="/orders" />
          <StatCard label="Shipped This Month" value={fmt(stats.shipped_this_month)} icon={Truck} href="/orders" />
          {!isWarehouse && <StatCard label="Revenue This Month" value={fmtUSD(stats.revenue_this_month)} icon={DollarSign} href="/reports" />}
          <StatCard label="Inbound In-Transit" value={fmt(stats.inbound_in_transit)} icon={Package} href="/logistics" />
          <StatCard
            label="Low Stock Alerts"
            value={fmt(stats.low_stock_alerts)}
            icon={AlertTriangle}
            alert={parseInt(stats.low_stock_alerts) > 0}
            href="/warehouse"
          />
          {!isWarehouse && <StatCard
            label="Unpaid Balance"
            value={fmtUSD(stats.unpaid_balance_usd)}
            icon={DollarSign}
            alert={parseFloat(stats.unpaid_balance_usd) > 0}
            href="/orders"
          />}
          {!isWarehouse && <StatCard
            label="Unverified Payments"
            value={fmt(stats.unverified_payments)}
            icon={Clock}
            alert={parseInt(stats.unverified_payments) > 0}
            href="/orders"
          />}
          {!isWarehouse && <StatCard
            label="Payments w/ Issues"
            value={fmt(stats.payments_with_issues)}
            icon={XCircle}
            alert={parseInt(stats.payments_with_issues) > 0}
            href="/orders"
          />}
          {!isWarehouse && <StatCard
            label="Refunds Owed"
            value={fmt(stats.refunds_owed_count)}
            sub={fmtUSD(stats.refunds_owed_usd)}
            icon={RefreshCw}
            alert={parseInt(stats.refunds_owed_count) > 0}
            href="/orders"
          />}
          {!isWarehouse && <StatCard
            label="Overdue Refunds"
            value={fmt(stats.overdue_refunds)}
            icon={AlertTriangle}
            alert={parseInt(stats.overdue_refunds) > 0}
            href="/orders"
          />}
          <StatCard
            label="Shipment Issues"
            value={fmt(stats.outbound_issues)}
            icon={XCircle}
            alert={parseInt(stats.outbound_issues) > 0}
            href="/orders"
          />
          {!isWarehouse && <StatCard
            label="Warehouse Payables"
            value={fmtUSD(stats.warehouse_payables_usd)}
            icon={Warehouse}
            alert={parseFloat(stats.warehouse_payables_usd) > 0}
            href="/warehouse"
          />}
          {!isWarehouse && <StatCard
            label="China-Direct Awaiting"
            value={fmt(stats.china_direct_awaiting)}
            icon={Globe}
            href="/orders"
          />}
        </div>
      )}

      {/* Charts Row (revenue chart is hidden for warehouse role) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Bar Chart */}
        {!isWarehouse && <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Revenue — Last 6 Months (USD)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {revenueLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : revenue.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue} barSize={20} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(val: number) => [`$${val.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="warehouse" name="Warehouse" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="china" name="China Direct" fill="#8b5cf6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>}

        {/* Status + Channel donuts */}
        <div className="flex flex-col gap-4">
          <Card className="shadow-xs flex-1">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-medium">Orders by Status</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {statusData.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="40%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs flex-1">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-medium">Orders by Channel (This Month)</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {channelData.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">No orders this month</div>
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={channelData} dataKey="value" cx="40%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2}>
                      {channelData.map((entry, i) => (
                        <Cell key={entry.name} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Feed + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-1">
                {activity.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="text-muted-foreground flex-shrink-0">
                      <ActivityIcon type={row.record_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {row.reference}
                        </span>
                        <ActivityTypeBadge type={row.record_type} />
                        {row.status && (
                          <Badge
                            style={{ backgroundColor: STATUS_COLORS[row.status] || '#94a3b8' }}
                            className="text-white text-xs px-1.5 py-0 border-0"
                          >
                            {row.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{row.customer_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {row.amount_usd && (
                        <p className="text-sm font-medium">{fmtUSD(row.amount_usd)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {row.event_at
                          ? new Date(row.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.filter(link => !link.roles || link.roles.includes(role)).map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="group flex flex-col gap-1 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/50 transition-all"
                >
                  <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-foreground">{link.label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{link.desc}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
