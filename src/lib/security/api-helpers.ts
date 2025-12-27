/**
 * API Route Security Helpers
 * Utilities to easily add security checks to API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../auth';
import { getCurrentOrganization } from '../auth-helpers';
import { checkSecurity } from './security-checker';
import { db } from '../db';
import type { PlanName } from '../permissions';
import type { ObjectType } from '../salesforce-inspired-security';
import type { Action } from './index';

export interface SecurityCheckParams {
  featureKey?: string;
  objectType?: ObjectType;
  objectId?: string;
  action: Action;
  fieldName?: string;
}

/**
 * Get security context for current user
 */
export async function getSecurityContext(): Promise<{
  planName: PlanName;
  profileId: string | null;
  userId: string;
  organizationId: string | null;
} | null> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return null;
    }

    // Get plan from organization
    const planResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/organization/plan`,
      {
        headers: {
          Cookie: '', // Will be set by middleware
        },
      }
    );

    if (!planResponse.ok) {
      return null;
    }

    const planData = await planResponse.json();
    const planName = planData.plan as PlanName;

    // Get user's profile ID
    const dbUser = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    return {
      planName,
      profileId: dbUser?.profile_id || null,
      userId: user.id,
      organizationId: user.organizationId,
    };
  } catch (error) {
    console.error('Error getting security context:', error);
    return null;
  }
}

/**
 * Perform security check in API route
 * Returns NextResponse with error if check fails, or null if check passes
 */
export async function requireSecurity(
  params: SecurityCheckParams
): Promise<NextResponse | null> {
  const context = await getSecurityContext();
  
  if (!context) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const result = await checkSecurity({
    planName: context.planName,
    profileId: context.profileId,
    featureKey: params.featureKey,
    objectType: params.objectType,
    objectId: params.objectId,
    action: params.action,
    fieldName: params.fieldName,
    userId: context.userId,
    organizationId: context.organizationId,
  });

  if (!result.allowed) {
    return NextResponse.json(
      { 
        error: result.reason || 'Access denied',
        failedLevel: result.failedLevel,
      },
      { status: 403 }
    );
  }

  return null; // Check passed
}

/**
 * Wrapper for API route handlers with security
 * Usage:
 * 
 * export async function PUT(req: NextRequest, { params }) {
 *   return withSecurity(
 *     { objectType: 'Property', action: 'edit', objectId: params.id },
 *     async (context) => {
 *       // Your route logic here
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 * }
 */
export async function withSecurity<T = any>(
  params: SecurityCheckParams,
  handler: (context: NonNullable<Awaited<ReturnType<typeof getSecurityContext>>>) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  const securityError = await requireSecurity(params);
  if (securityError) {
    return securityError;
  }

  const context = await getSecurityContext();
  if (!context) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    ) as NextResponse<T>;
  }

  return handler(context);
}

