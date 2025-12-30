/**
 * Hook to check page access with loading states
 * Combines access checks and provides loading state management
 */

import { useAccess } from './use-access';
import { useSuperAdmin } from './use-super-admin';

export function usePageAccess() {
  const { isLoading: isAccessLoading, ...accessData } = useAccess();
  const { isLoading: isSuperAdminLoading, ...superAdminData } = useSuperAdmin();

  return {
    ...accessData,
    ...superAdminData,
    isLoading: isAccessLoading || isSuperAdminLoading,
    isAccessLoading,
    isSuperAdminLoading,
  };
}

