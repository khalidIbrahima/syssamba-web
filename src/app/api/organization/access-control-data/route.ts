import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { db } from '@/lib/db';

/**
 * GET /api/organization/access-control-data
 * Get current user's profile permissions only
 * Returns profile-level object permissions
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's profile
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: userId },
    });

    const profileId = userRecord?.profile_id || null;

    // Get profile object permissions
    let objectPermissions: Array<{
      objectType: string;
      accessLevel: 'None' | 'Read' | 'ReadWrite' | 'All';
      canCreate: boolean;
      canRead: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canViewAll: boolean;
    }> = [];

    if (profileId) {
      const permissions = await getProfileObjectPermissions(profileId);
      objectPermissions = permissions.map(p => ({
        objectType: p.objectType,
        accessLevel: p.accessLevel,
        canCreate: p.canCreate,
        canRead: p.canRead,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canViewAll: p.canViewAll,
      }));
    }

    return NextResponse.json({
      profileId,
      objectPermissions,
    });
  } catch (error: any) {
    console.error('Error fetching profile permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

