import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

/**
 * GET /api/user/current
 * Get current user's organization ID
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

    // Get organization name if user has an organization
    let organizationName = null;
    if (user.organizationId) {
      try {
        const organization = await db.selectOne<{
          id: string;
          name: string | null;
        }>('organizations', {
          eq: { id: user.organizationId },
        });
        organizationName = organization?.name || null;
      } catch (error) {
        console.warn('Error fetching organization name:', error);
        // Don't fail the request if organization fetch fails
      }
    }

    return NextResponse.json({
      id: user.id,
      organizationId: user.organizationId,
      organizationName,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

