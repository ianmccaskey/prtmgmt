import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MySettingsDialog } from '@/app/layout/MySettingsDialog';
import {
  Home,
  ShoppingCart,
  Users,
  FlaskConical,
  Layers,
  Warehouse,
  Truck,
  BarChart3,
  Settings,
  Package,
  HandCoins,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useAppUser } from '@/app/AppContext';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Sales Orders', href: '/orders', icon: ShoppingCart },
  // Sales reps create/pick customers inside the order form but don't get
  // the browsable customer list.
  { label: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'logistics'] },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Batches', href: '/batches', icon: FlaskConical },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse },
  { label: 'Logistics', href: '/logistics', icon: Truck },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Commissions', href: '/commissions', icon: HandCoins, roles: ['admin', 'logistics'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

// Bottom tab bar (phones): the 4 destinations each role actually lives
// in, ordered; everything else stays one tap away behind More (the
// sheet). Falls back to the first four role-visible items.
const BOTTOM_TABS_BY_ROLE: Record<string, string[]> = {
  admin: ['/', '/orders', '/warehouse', '/commissions'],
  logistics: ['/', '/orders', '/logistics', '/customers'],
  sales_rep: ['/', '/orders', '/products', '/batches'],
  warehouse: ['/', '/orders', '/warehouse', '/logistics'],
};

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppSidebar() {
  const location = useLocation();
  const { role } = useAppUser();
  // On phones the sidebar is a sheet overlay — picking a page must close it.
  const { setOpenMobile } = useSidebar();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  return (
    <Sidebar className="border-r border-border/60 bg-[#0f1117]" collapsible="icon">
      <SidebarHeader className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <div className="w-7 h-7 rounded bg-blue-500 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight group-data-[collapsible=icon]:hidden">
            PeptideOps
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-[#0f1117]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="text-white/60 hover:text-white hover:bg-white/10 data-[active=true]:bg-white/10 data-[active=true]:text-white h-8 text-sm"
                    >
                      <Link to={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * Phone-only bottom tab bar (hidden ≥ md, matching the sidebar's mobile
 * breakpoint): the role's 4 core destinations always one thumb-tap away,
 * plus More opening the full nav sheet. Safe-area padded for gesture-bar
 * phones.
 */
function MobileBottomNav() {
  const location = useLocation();
  const { role } = useAppUser();
  const { setOpenMobile } = useSidebar();

  const visible = NAV_ITEMS.filter(i => !i.roles || i.roles.includes(role));
  const priority = BOTTOM_TABS_BY_ROLE[role] || [];
  const tabs = [
    ...priority.map(href => visible.find(i => i.href === href)).filter((i): i is NavItem => !!i),
    ...visible,
  ].filter((item, idx, arr) => arr.findIndex(x => x.href === item.href) === idx).slice(0, 4);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
  // More is "active" when the current page isn't one of the visible tabs.
  const moreActive = !tabs.some(t => isActive(t.href));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {tabs.map(item => (
          <Link key={item.href} to={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium ${isActive(item.href) ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <item.icon className={`h-5 w-5 ${isActive(item.href) ? 'text-blue-600' : ''}`} />
            {/* Short labels: "Sales Orders" → "Orders" keeps tabs legible */}
            {item.href === '/orders' ? 'Orders' : item.label}
          </Link>
        ))}
        <button type="button" onClick={() => setOpenMobile(true)}
          className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium ${moreActive ? 'text-blue-600' : 'text-muted-foreground'}`}>
          <Layers className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profileMissing, displayName, role } = useAppUser();
  const [mySettingsOpen, setMySettingsOpen] = useState(false);
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="h-10 border-b border-border/60 flex items-center px-4 flex-shrink-0 bg-background">
            <SidebarTrigger className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mx-3 h-4" />
            <button
              className="ml-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted/60"
              onClick={() => setMySettingsOpen(true)}
              title="My Settings"
            >
              <span className="font-medium text-foreground">{displayName}</span>
              <span className="capitalize rounded bg-muted px-1.5 py-0.5">{role.replace('_', ' ')}</span>
            </button>
          </header>
          <MySettingsDialog open={mySettingsOpen} onClose={() => setMySettingsOpen(false)} />
          {profileMissing && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5">
              No user profile is configured for your account — running with temporary admin access.
              Add your email under Settings → Users to assign a proper role.
            </div>
          )}
          <main className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
