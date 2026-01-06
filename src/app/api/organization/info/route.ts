import { NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for updating organization info (limited fields for regular admins)
const updateOrganizationInfoSchema = z.object({
  name: z.string().min(1, 'Le nom de l\'organisation est requis').max(200).optional(),
  type: z.enum(['agency', 'sci', 'syndic', 'individual']).optional(),
  country: z.string().length(2, 'Le code pays doit contenir 2 caractères').optional(),
});

// GET - Get current organization's info
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

    // If user has no organization, return null (user is in setup phase)
    if (!user.organizationId) {
      return NextResponse.json({
        organization: null,
      });
    }

    // Get organization info
    const organization = await db.selectOne<{
      id: string;
      name: string | null;
      slug: string | null;
      type: string | null;
      country: string;
      custom_extranet_domain: string | null;
      is_configured: boolean;
      created_at: string;
      updated_at: string;
    }>('organizations', {
      eq: { id: user.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        type: organization.type,
        country: organization.country,
        customExtranetDomain: organization.custom_extranet_domain,
        isConfigured: organization.is_configured,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching organization info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch organization info' },
      { status: 500 }
    );
  }
}

// PATCH - Update current organization's info (limited fields)
export async function PATCH(request: Request) {
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
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    // Check if user has permission to edit organization (owner or admin)
    const userProfile = await db.selectOne<{
      role: string;
    }>('users', {
      eq: { id: user.id },
    });

    if (!userProfile || !['owner', 'admin'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only organization owners and admins can update organization info' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateOrganizationInfoSchema.parse(body);

    // Check if organization exists
    const existing = await db.selectOne<{ id: string }>('organizations', {
      eq: { id: user.organizationId },
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
    if (validatedData.type !== undefined) {
      updateData.type = validatedData.type;
    }
    if (validatedData.country !== undefined) {
      updateData.country = validatedData.country;
    }

    await db.update('organizations', updateData, { id: user.organizationId });

    // Fetch updated organization
    const updated = await db.selectOne<{
      id: string;
      name: string | null;
      type: string | null;
      country: string;
    }>('organizations', {
      eq: { id: user.organizationId },
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
        type: updated.type,
        country: updated.country,
      },
      message: 'Informations de l\'organisation mises à jour avec succès',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating organization info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update organization info' },
      { status: 500 }
    );
  }
}
