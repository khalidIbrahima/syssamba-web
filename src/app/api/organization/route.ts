import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { organizations, subscriptions, plans, users, units } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { z } from 'zod';

const updateOrganizationSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  type: z.enum(['agency', 'sci', 'syndic', 'individual']).optional(),
  country: z.string().length(2).optional(),
  customExtranetDomain: z.string().url().optional().nullable(),
});

/**
 * GET /api/organization
 * Get current organization details with statistics
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get active subscription
    const activeSubscriptions = await db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        planName: plans.name,
        planDisplayName: plans.displayName,
        billingPeriod: subscriptions.billingPeriod,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.organizationId, organization.id),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    const subscription = activeSubscriptions[0] || null;

    // Get statistics
    const [usersCount] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organization.id),
          eq(users.isActive, true)
        )
      );

    const [unitsCount] = await db
      .select({ count: count() })
      .from(units)
      .where(eq(units.organizationId, organization.id));

    return NextResponse.json({
      id: organization.id,
      organization: {
        ...organization,
        stats: {
          activeUsers: usersCount?.count || 0,
          totalUnits: unitsCount?.count || 0,
        },
        subscription,
      },
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization
 * Update organization settings
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await checkAuth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to edit organization (profile-based)
    const { canUserPerformAction } = await import('@/lib/access-control');
    const canEdit = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to edit organization' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = updateOrganizationSchema.parse(body);

    // Update organization
    const [updated] = await db
      .update(organizations)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, user.organizationId))
      .returning();

    return NextResponse.json({ organization: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

