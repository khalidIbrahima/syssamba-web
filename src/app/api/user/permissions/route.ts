/**
 * GET /api/user/permissions
 * Get current user's permissions (read from users.profile_id → profile_object_permissions)
 */

import { NextResponse } from 'next/server';
import { getCurrentUserPermissions } from '@/lib/security/profile-permissions-reader';

export async function GET() {
  try {
    const permissions = await getCurrentUserPermissions();

    return NextResponse.json({
      permissions,
      count: permissions.length,
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

