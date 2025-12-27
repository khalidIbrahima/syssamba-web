import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { getCurrentUser } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import {
  getAllFeatures,
  getPlanFeatures,
  getAllPlanFeaturesWithStatus,
  getPlanFeaturesByCategory,
  updatePlanFeatures,
  isFeatureEnabled,
} from '@/lib/plan-features';
import type { PlanName } from '@/lib/permissions';
import { z } from 'zod';

/**
 * GET /api/organization/users/plan-features
 * Get features for a plan or all features
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
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to edit organization (profile-based)
    const canEdit = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view plan features' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const planName = searchParams.get('plan') as PlanName | null;
    const groupByCategory = searchParams.get('groupByCategory') === 'true';
    const withStatus = searchParams.get('withStatus') === 'true';

    // If plan is specified, return features for that plan
    if (planName) {
      if (groupByCategory) {
        const featuresByCategory = await getPlanFeaturesByCategory(planName);
        return NextResponse.json({
          planName,
          featuresByCategory,
        });
      } else if (withStatus) {
        const featuresWithStatus = await getAllPlanFeaturesWithStatus(planName);
        return NextResponse.json({
          planName,
          features: featuresWithStatus,
        });
      } else {
        const planFeatures = await getPlanFeatures(planName);
        return NextResponse.json({
          planName,
          features: planFeatures,
        });
      }
    }

    // Return all features
    const allFeatures = await getAllFeatures();
    return NextResponse.json({
      features: allFeatures,
    });
  } catch (error) {
    console.error('Error fetching plan features:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization/users/plan-features
 * Update features for a plan
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
    const canEdit = await canUserPerformAction(
      user.id,
      user.organizationId,
      'Organization',
      'edit'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to update plan features' },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // Validate input
    const updateSchema = z.object({
      planName: z.enum(['freemium', 'starter', 'pro', 'agency', 'enterprise']),
      features: z.record(z.string(), z.boolean()),
    });

    const validatedData = updateSchema.parse(body);
    const { planName, features } = validatedData;

    // Update features
    const success = await updatePlanFeatures(
      planName as PlanName,
      features
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update plan features' },
        { status: 500 }
      );
    }

    // Return updated features
    const updatedFeatures = await getAllPlanFeaturesWithStatus(planName as PlanName);

    return NextResponse.json({
      planName,
      features: updatedFeatures,
      message: 'Plan features updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating plan features:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

