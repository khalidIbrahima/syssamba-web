'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRolePermissions, type UserRole, type RolePermissions } from '@/lib/role-permissions';

async function getCurrentUserRole(): Promise<UserRole> {
  try {
    const response = await fetch('/api/user/current', {
      credentials: 'include',
    });
    if (!response.ok) {
      return 'viewer';
    }
    const data = await response.json();
    return (data.role as UserRole) || 'viewer';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'viewer';
  }
}

/**
 * Hook to get role-based permissions for the current user
 */
export function useRolePermissions() {
  const { data: role = 'viewer' } = useQuery({
    queryKey: ['user-role'],
    queryFn: getCurrentUserRole,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const permissions: RolePermissions = useMemo(() => {
    return getRolePermissions(role as UserRole);
  }, [role]);

  return {
    permissions,
    role: role as UserRole,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isAccountant: role === 'accountant',
    isAgent: role === 'agent',
    isViewer: role === 'viewer',
  };
}

