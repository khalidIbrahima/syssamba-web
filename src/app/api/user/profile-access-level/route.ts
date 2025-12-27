/**
 * GET /api/user/profile-access-level
 * Get current user's profile access level summary
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserProfileAccessLevel } from '@/lib/security/profile-access-level';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessSummary = await getUserProfileAccessLevel(user.id);

    if (!accessSummary) {
      return NextResponse.json({
        profileId: null,
        profileName: null,
        overallAccessLevel: 'None',
        objectAccessLevels: {},
        canCreateAny: false,
        canEditAny: false,
        canDeleteAny: false,
        canViewAllAny: false,
        totalObjects: 0,
        accessibleObjects: 0,
        permissions: [],
      });
    }

    return NextResponse.json(accessSummary);
  } catch (error) {
    console.error('Error fetching profile access level:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

