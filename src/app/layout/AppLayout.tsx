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
  { label: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'sales_rep', 'logistics'] },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Batches', href: '/batches', icon: FlaskConical },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse },
  { label: 'Logistics', href: '/logistics', icon: Truck },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Commissions', href: '/commissions', icon: HandCoins, roles: ['admin', 'logistics'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

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
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
