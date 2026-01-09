import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * GET /api/organization/status
 * Get current user's organization configuration status
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

    if (!user.organizationId) {
      return NextResponse.json({
        hasOrganization: false,
        isConfigured: false,
      });
    }

    // Get organization configuration status
    const organization = await db.selectOne<{
      id: string;
      is_configured: boolean;
    }>('organizations', {
      eq: { id: user.organizationId },
    });

    return NextResponse.json({
      hasOrganization: true,
      isConfigured: organization?.is_configured === true,
      organizationId: user.organizationId,
    });
  } catch (error) {
    console.error('Error checking organization status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

