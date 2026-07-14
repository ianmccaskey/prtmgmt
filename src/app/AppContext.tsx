import React, { createContext, useContext, useMemo } from 'react';
import { useUser, useLoadAction } from '@uibakery/data';
import getMyProfile from '@/actions/settings/getMyProfile';
import { firstRow } from '@/lib/rows';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, UserX } from 'lucide-react';

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
  /** True when the logged-in platform user has no user_profiles row (bootstrap admin fallback). */
  profileMissing: boolean;
}

type ProfileRow = {
  id: number | null;
  user_id: number | null;
  email: string | null;
  role: AppRole | null;
  assigned_warehouse_id: number | null;
  display_name: string | null;
  avatar_file: string | null;
  assigned_warehouse_name: string | null;
  provisioned_count: number | string;
};

const AppUserContext = createContext<AppUser | null>(null);

function FullScreenNotice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-8">
      <Card className="max-w-md">
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          {icon}
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppUserProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const email = user.email || '';
  const [rows, loading] = useLoadAction(getMyProfile, [email], { email });

  const row = firstRow<ProfileRow>(rows);
  const hasProfile = !!row?.id;
  const provisionedCount = Number(row?.provisioned_count ?? 0);

  const value = useMemo<AppUser>(() => {
    if (hasProfile && row) {
      const role = (row.role || 'sales_rep') as AppRole;
      return {
        role,
        profileId: row.id,
        displayName: row.display_name || user.name || email,
        email,
        assignedWarehouseId: row.assigned_warehouse_id,
        assignedWarehouseName: row.assigned_warehouse_name,
        isAdmin: role === 'admin',
        isSalesRep: role === 'sales_rep',
        isWarehouse: role === 'warehouse',
        profileMissing: false,
      };
    }
    // Bootstrap fallback: admin access is granted ONLY while no profile has an
    // email yet (fresh install / pre-provisioning). Once any email-linked
    // profile exists, unmatched users are blocked below instead.
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
  }, [hasProfile, row, user.name, email]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  // Provisioned workspace + unknown user → hard stop (no silent admin access).
  if (!hasProfile && provisionedCount > 0) {
    return (
      <FullScreenNotice
        icon={<UserX className="w-8 h-8 text-muted-foreground" />}
        title="Your account isn't set up yet"
        body={`No user profile exists for ${email || 'your account'}. Ask an administrator to add you under Settings → Users with this exact email.`}
      />
    );
  }

  // Warehouse users must have a warehouse assignment — without one, scoping
  // rules can't apply and they'd silently see every warehouse.
  if (hasProfile && value.isWarehouse && !value.assignedWarehouseId) {
    return (
      <FullScreenNotice
        icon={<ShieldAlert className="w-8 h-8 text-muted-foreground" />}
        title="No warehouse assigned"
        body="Your account has the warehouse role but no assigned warehouse. Ask an administrator to set one under Settings → Users."
      />
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
