import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  getProfileObjectPermissions,
  getProfileFieldPermissions,
} from '@/lib/profiles';

/**
 * GET /api/organization/access-control-data
 * Get access control data for the current user based on their profile
 */
export async function GET() {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user has no organization, return empty permissions
    if (!user.organizationId) {
      return NextResponse.json({
        profileId: null,
        objectPermissions: [],
        fieldPermissions: [],
      });
    }

    // Get user's profile
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    if (!userRecord || !userRecord.profile_id) {
      // User has no profile, return empty permissions
      return NextResponse.json({
        profileId: null,
        objectPermissions: [],
        fieldPermissions: [],
      });
    }

    // Get profile permissions
    const objectPermissions = await getProfileObjectPermissions(userRecord.profile_id);
    const fieldPermissions = await getProfileFieldPermissions(userRecord.profile_id);

    return NextResponse.json({
      profileId: userRecord.profile_id,
      objectPermissions,
      fieldPermissions,
    });
  } catch (error) {
    console.error('Error fetching access control data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

