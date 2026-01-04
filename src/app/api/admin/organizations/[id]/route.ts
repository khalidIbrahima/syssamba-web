import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { z } from 'zod';

// Schema for updating organization
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  type: z.enum(['agency', 'sci', 'syndic', 'individual']).optional(),
  country: z.string().length(2).optional(),
  customExtranetDomain: z.string().optional().nullable(),
  isConfigured: z.boolean().optional(),
});

// GET - Get a specific organization with full details
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    // Check if user is super-admin
    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Get organization
    const organization = await db.selectOne<{
      id: string;
      name: string | null;
      slug: string | null;
      type: string | null;
      country: string;
      extranet_tenants_count: number;
      custom_extranet_domain: string | null;
      stripe_customer_id: string | null;
      is_configured: boolean;
      created_at: string;
      updated_at: string;
    }>('organizations', {
      eq: { id: id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get active subscription
    const subscriptions = await db.select<{
      id: string;
      plan_id: string;
      status: string;
      created_at: string;
    }>('subscriptions', {
      eq: { organization_id: id },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
    });

    const subscription = subscriptions[0] || null;

    // Get plan details
    let plan = null;
    if (subscription?.plan_id) {
      const planRecord = await db.selectOne<{
        id: string;
        name: string;
        display_name: string;
        lots_limit: number | null;
        users_limit: number | null;
        extranet_tenants_limit: number | null;
      }>('plans', {
        eq: { id: subscription.plan_id },
      });

      if (planRecord) {
        plan = {
          id: planRecord.id,
          name: planRecord.name,
          displayName: planRecord.display_name,
          limits: {
            lots: planRecord.lots_limit,
            users: planRecord.users_limit,
            extranetTenants: planRecord.extranet_tenants_limit,
          },
        };
      }
    }

    // Get usage counts
    const userCount = await db.count('users', {
      eq: { organization_id: id },
    });

    const unitCount = await db.count('units', {
      eq: { organization_id: id },
    });

    const tenantCount = await db.count('tenants', {
      eq: { organization_id: id },
    });

    const propertyCount = await db.count('properties', {
      eq: { organization_id: id },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        type: organization.type,
        country: organization.country,
        plan,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          createdAt: subscription.created_at,
        } : null,
        extranetTenantsCount: organization.extranet_tenants_count,
        customExtranetDomain: organization.custom_extranet_domain,
        stripeCustomerId: organization.stripe_customer_id,
        isConfigured: organization.is_configured,
        usage: {
          users: userCount,
          units: unitCount,
          tenants: tenantCount,
          properties: propertyCount,
        },
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PATCH - Update organization
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await checkAuth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    const { id } = await context.params;
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const isAdmin = await isSuperAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super-admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateOrganizationSchema.parse(body);

    // Check if organization exists
    const existing = await db.selectOne<{ id: string }>('organizations', {
      eq: { id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.slug !== undefined) {
      // Check if slug is unique
      const slugExists = await db.selectOne<{ id: string }>('organizations', {
        eq: { slug: validatedData.slug },
      });

      if (slugExists && slugExists.id !== id) {
        return NextResponse.json(
          { error: 'Slug already exists' },
          { status: 400 }
        );
      }

      updateData.slug = validatedData.slug;
    }
    if (validatedData.type !== undefined) {
      updateData.type = validatedData.type;
    }
    if (validatedData.country !== undefined) {
      updateData.country = validatedData.country;
    }
    if (validatedData.customExtranetDomain !== undefined) {
      updateData.custom_extranet_domain = validatedData.customExtranetDomain;
    }
    if (validatedData.isConfigured !== undefined) {
      updateData.is_configured = validatedData.isConfigured;
    }

    await db.update('organizations', updateData, { id });

    // Fetch updated organization
    const updated = await db.selectOne<{
      id: string;
      name: string | null;
      slug: string | null;
      type: string | null;
      country: string;
      custom_extranet_domain: string | null;
      is_configured: boolean;
    }>('organizations', {
      eq: { id: id },
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Organization not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        type: updated.type,
        country: updated.country,
        customExtranetDomain: updated.custom_extranet_domain,
        isConfigured: updated.is_configured,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update organization' },
      { status: 500 }
    );
  }
}

