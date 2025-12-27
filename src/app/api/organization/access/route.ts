import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getEnabledPlanFeatures } from '@/lib/plan-features';
import type { PlanName } from '@/lib/permissions';

/**
 * GET /api/organization/access
 * Get user's access information (features from plan only, permissions come from profile)
 */
export async function GET(req: Request) {
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

    // If user has no organization, return default freemium plan with no features
    if (!user.organizationId) {
      return NextResponse.json({
        planName: 'freemium' as PlanName,
        profileId: null,
        enabledFeatures: [],
      });
    }

    // Get plan from organization
    const planResponse = await fetch(`${req.url.replace('/access', '/plan')}`, {
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
      },
    });

    if (!planResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch plan information' },
        { status: 500 }
      );
    }

    const planData = await planResponse.json();
    const planName = planData.plan as PlanName;

    // Get enabled features for the plan (permissions come from profile via /access-control-data)
    const enabledFeatures = await getEnabledPlanFeatures(planName);

    // Get user's profile ID
    const userRecord = await db.selectOne<{
      profile_id: string | null;
    }>('users', {
      eq: { id: user.id },
    });

    return NextResponse.json({
      planName,
      profileId: userRecord?.profile_id || null,
      enabledFeatures: Array.from(enabledFeatures),
    });
  } catch (error) {
    console.error('Error fetching access information:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/access/check
 * Check if user can access a specific feature or perform an action
 * Now uses profile permissions instead of role
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const { type, featureKey, permission } = body;

    // Get plan from organization
    const planResponse = await fetch(`${req.url.replace('/access/check', '/plan')}`, {
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
      },
    });

    if (!planResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch plan information' },
        { status: 500 }
      );
    }

    const planData = await planResponse.json();
    const planName = planData.plan as PlanName;

    // Get enabled features for the plan
    const enabledFeatures = await getEnabledPlanFeatures(planName);

    // Get user's profile permissions
    const profileResponse = await fetch(`${req.url.replace('/access/check', '/access-control-data')}`, {
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
      },
    });

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch profile permissions' },
        { status: 500 }
      );
    }

    const profileData = await profileResponse.json();
    const objectPermissions = profileData.objectPermissions || [];

    let result = false;

    if (type === 'feature' && featureKey) {
      // Check if feature is enabled in plan
      result = enabledFeatures.has(featureKey);
    } else if (type === 'action' && permission) {
      // Map permission to object permission check
      // This is a simplified mapping - in production, you'd have a more comprehensive mapping
      const permissionMap: Record<string, { objectType: string; action: 'read' | 'create' | 'edit' | 'delete' }> = {
        canViewAllProperties: { objectType: 'Property', action: 'read' },
        canCreateProperties: { objectType: 'Property', action: 'create' },
        canEditProperties: { objectType: 'Property', action: 'edit' },
        canDeleteProperties: { objectType: 'Property', action: 'delete' },
        canViewAllUnits: { objectType: 'Unit', action: 'read' },
        canCreateUnits: { objectType: 'Unit', action: 'create' },
        canEditUnits: { objectType: 'Unit', action: 'edit' },
        canDeleteUnits: { objectType: 'Unit', action: 'delete' },
        canViewAllTenants: { objectType: 'Tenant', action: 'read' },
        canCreateTenants: { objectType: 'Tenant', action: 'create' },
        canEditTenants: { objectType: 'Tenant', action: 'edit' },
        canDeleteTenants: { objectType: 'Tenant', action: 'delete' },
        canViewSettings: { objectType: 'Organization', action: 'read' },
      };

      const mapped = permissionMap[permission];
      if (mapped) {
        const objPerm = objectPermissions.find((p: any) => p.objectType === mapped.objectType);
        if (objPerm) {
          switch (mapped.action) {
            case 'read':
              result = objPerm.canRead && objPerm.canViewAll;
              break;
            case 'create':
              result = objPerm.canCreate;
              break;
            case 'edit':
              result = objPerm.canEdit;
              break;
            case 'delete':
              result = objPerm.canDelete;
              break;
          }
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid request. Must specify type (feature/action) and featureKey or permission' },
        { status: 400 }
      );
    }

    return NextResponse.json({ allowed: result });
  } catch (error) {
    console.error('Error checking access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

