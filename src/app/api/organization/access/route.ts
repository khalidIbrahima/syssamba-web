import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { getEnabledPlanFeatures } from '@/lib/plan-features';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { db } from '@/lib/db';
import type { PlanName } from '@/lib/permissions';

/**
 * GET /api/organization/access
 * Get current user's plan features and profile permissions
 * Returns both plan-level features and profile-level object permissions
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

    // Get plan name from organization
    let planName: PlanName = 'freemium';
    let enabledFeatures: string[] = [];

    if (user.organizationId) {
      // Get active subscription for the organization
      const subscriptions = await db.select<{
        plan_id: string;
        status: string;
      }>('subscriptions', {
        eq: { organization_id: user.organizationId },
        limit: 1,
      });

      const subscription = subscriptions[0];

      if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
        // Get plan details
        const planRecord = await db.selectOne<{
          name: string;
        }>('plans', {
          eq: { id: subscription.plan_id },
        });

        if (planRecord) {
          planName = planRecord.name as PlanName;
          // Get enabled features for this plan (returns Set, convert to array)
          const featuresSet = await getEnabledPlanFeatures(planName);
          enabledFeatures = Array.from(featuresSet);
        }
      } else {
        // No active subscription, use freemium
        const featuresSet = await getEnabledPlanFeatures('freemium');
        enabledFeatures = Array.from(featuresSet);
      }
    } else {
      // No organization, use freemium
      const featuresSet = await getEnabledPlanFeatures('freemium');
      enabledFeatures = Array.from(featuresSet);
    }

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
      planName,
      profileId,
      enabledFeatures,
      objectPermissions,
    });
  } catch (error: any) {
    console.error('Error fetching access information:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

