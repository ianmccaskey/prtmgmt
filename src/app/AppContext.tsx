import React, { createContext, useContext, useMemo } from 'react';
import { useUser, useLoadAction } from '@uibakery/data';
import getMyProfile from '@/actions/settings/getMyProfile';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export type AppRole = 'admin' | 'sales_rep' | 'warehouse';

export interface AppUser {
  /** Effective role driving all access control (from user_profiles, not platform roles). */
  role: AppRole;
  /** user_profiles.id — pass this into every *_user_id action param. Null when no profile row matches. */
  profileId: number | null;
  displayName: string;
  email: string;
  assignedWarehouseId: number | null;
  assignedWarehouseName: string | null;
  isAdmin: boolean;
  isSalesRep: boolean;
  isWarehouse: boolean;
  /** True when the logged-in platform user has no user_profiles row (falls back to admin). */
  profileMissing: boolean;
}

type ProfileRow = {
  id: number;
  user_id: number | null;
  email: string | null;
  role: AppRole;
  assigned_warehouse_id: number | null;
  display_name: string | null;
  avatar_file: string | null;
  assigned_warehouse_name: string | null;
};

const AppUserContext = createContext<AppUser | null>(null);

export function AppUserProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const email = user.email || '';
  const [rows, loading] = useLoadAction(getMyProfile, [email], { email });

  const profile = ((rows as ProfileRow[]) || [])[0];

  const value = useMemo<AppUser>(() => {
    if (profile) {
      const role = profile.role;
      return {
        role,
        profileId: profile.id,
        displayName: profile.display_name || user.name || email,
        email,
        assignedWarehouseId: profile.assigned_warehouse_id,
        assignedWarehouseName: profile.assigned_warehouse_name,
        isAdmin: role === 'admin',
        isSalesRep: role === 'sales_rep',
        isWarehouse: role === 'warehouse',
        profileMissing: false,
      };
    }
    // No matching user_profiles row: fall back to admin so the owner is never
    // locked out on first run; AppLayout surfaces a visible warning banner.
    return {
      role: 'admin',
      profileId: null,
      displayName: user.name || email,
      email,
      assignedWarehouseId: null,
      assignedWarehouseName: null,
      isAdmin: true,
      isSalesRep: false,
      isWarehouse: false,
      profileMissing: true,
    };
  }, [profile, user.name, email]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  return <AppUserContext.Provider value={value}>{children}</AppUserContext.Provider>;
}

export function useAppUser(): AppUser {
  const ctx = useContext(AppUserContext);
  if (!ctx) throw new Error('useAppUser must be used within AppUserProvider');
  return ctx;
}

/** Route/section guard. Renders children only when the current role is allowed. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { role } = useAppUser();
  if (!roles.includes(role)) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <ShieldAlert className="w-8 h-8 text-muted-foreground" />
            <p className="font-medium">You don't have access to this page</p>
            <p className="text-sm text-muted-foreground">
              This area is restricted to {roles.map(r => r.replace('_', ' ')).join(' and ')} users.
              Contact an administrator if you believe this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
