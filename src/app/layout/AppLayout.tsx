import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Sales Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'sales_rep'] },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Batches', href: '/batches', icon: FlaskConical },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse },
  { label: 'Logistics', href: '/logistics', icon: Truck },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin', 'sales_rep'] },
  { label: 'Commissions', href: '/commissions', icon: HandCoins, roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: string;
}

function AppSidebar({ userRole }: { userRole?: string }) {
  const location = useLocation();
  const role = userRole || 'admin';

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
                      <Link to={item.href}>
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

export function AppLayout({ children, userRole }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="h-10 border-b border-border/60 flex items-center px-4 flex-shrink-0 bg-background">
            <SidebarTrigger className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mx-3 h-4" />
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
