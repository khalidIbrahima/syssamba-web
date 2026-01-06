import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, getCurrentUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for setup data
const setupSchema = z.object({
  organizationName: z.string().min(1, 'Le nom de l\'organisation est requis'),
  organizationType: z.enum(['individual', 'agency', 'sci', 'syndic']),
  country: z.string().min(1, 'Le pays est requis'),
  planName: z.string().min(1, 'Le nom du plan est requis'),
  billingPeriod: z.enum(['monthly', 'yearly']),
});

/**
 * POST /api/organization/setup
 * Complete organization setup for a new user
 */
export async function POST(request: NextRequest) {
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

    // Validate request body
    const body = await request.json();
    const validatedData = setupSchema.parse(body);

    // Check if user already has an organization
    if (user.organizationId) {
      return NextResponse.json(
        { error: 'User already has an organization' },
        { status: 400 }
      );
    }

    // Generate a unique slug and subdomain for the organization
    const baseSlug = validatedData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let subdomain = baseSlug; // Use same value for subdomain
    let counter = 1;

    // Ensure both slug and subdomain uniqueness
    while (true) {
      const existing = await db.selectOne<{ id: string }>('organizations', {
        or: [
          { eq: { slug } },
          { eq: { subdomain } },
        ],
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      subdomain = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create the organization
    const organization = await db.insertOne<{
      id: string;
      name: string;
      slug: string;
      subdomain: string;
      type: string;
      country: string;
      is_configured: boolean;
      created_at: string;
      updated_at: string;
    }>('organizations', {
      id: crypto.randomUUID(), // Generate new UUID for organization
      name: validatedData.organizationName,
      slug,
      subdomain, // Add subdomain
      type: validatedData.organizationType,
      country: validatedData.country,
      is_configured: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Update user with organization ID
    const updatedUser = await db.update('users', {
      organization_id: organization.id,
      updated_at: new Date().toISOString(),
    }, {
      eq: { id: user.id },
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user organization' },
        { status: 500 }
      );
    }

    // TODO: Create subscription if plan is not freemium
    // For now, we'll skip subscription creation and let users manage it later

    const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
    
    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subdomain: organization.subdomain,
        type: organization.type,
        country: organization.country,
      },
      subdomainUrl: `https://${organization.subdomain}.${MAIN_DOMAIN}`,
      message: 'Organisation configurée avec succès',
    });

  } catch (error) {
    console.error('Organization setup error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
