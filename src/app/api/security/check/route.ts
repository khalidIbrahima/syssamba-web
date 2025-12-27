/**
 * Security Check API Route
 * Performs complete security check across all levels
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSecurity } from '@/lib/security/security-checker';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentOrganization } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { allowed: false, reason: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      featureKey,
      objectType,
      objectId,
      action,
      fieldName,
    } = body;

    // Get user's plan and profile
    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { allowed: false, reason: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get plan from organization
    const planResponse = await fetch(`${request.url.replace('/security/check', '/organization/plan')}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (!planResponse.ok) {
      return NextResponse.json(
        { allowed: false, reason: 'Failed to fetch plan' },
        { status: 500 }
      );
    }

    const planData = await planResponse.json();
    const planName = planData.plan;

    // Get user's profile ID
    const dbUser = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    const profileId = dbUser?.profile_id || null;

    // Perform security check
    const result = await checkSecurity({
      planName,
      profileId,
      featureKey,
      objectType,
      objectId,
      action,
      fieldName,
      userId: user.id,
      organizationId: user.organizationId || undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Security check error:', error);
    return NextResponse.json(
      { allowed: false, reason: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

