import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { getCurrentUser, getCurrentOrganization } from '@/lib/auth-helpers';
import { canUserPerformAction } from '@/lib/access-control';
import { z } from 'zod';

const createRoleSchema = z.object({
  name: z.string().min(1, 'Le nom du rôle est requis').max(100),
  slug: z.string().min(1, 'Le slug est requis').max(50).regex(/^[a-z0-9_]+$/, 'Le slug doit contenir uniquement des lettres minuscules, chiffres et underscores'),
  description: z.string().optional(),
  color: z.string().optional().default('bg-gray-100 text-gray-800'),
  permissions: z.record(z.boolean()).optional().default({}),
});

/**
 * GET /api/organization/users/roles
 * Get all custom roles for the current organization
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

    // Check if user has permission to view users (profile-based)
    const canView = await canUserPerformAction(
      user.id,
      user.organizationId,
      'User',
      'read'
    );
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view roles' },
        { status: 403 }
      );
    }

    const customRoles = await db.select<{
      id: string;
      organization_id: string;
      name: string;
      slug: string;
      description: string | null;
      color: string;
      permissions: Record<string, boolean>;
      is_active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>('custom_roles', {
      eq: { organization_id: user.organizationId, is_active: true },
      orderBy: { column: 'created_at', ascending: true },
    });

    return NextResponse.json({
      roles: customRoles.map(role => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        color: role.color,
        permissions: role.permissions,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching custom roles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/users/roles
 * Create a new custom role
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

    // Check if user has permission to edit users (profile-based)
    const canEdit = await canUserPerformAction(
      user.id,
      user.organizationId,
      'User',
      'edit'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to create roles' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createRoleSchema.parse(body);

    // Check if slug already exists for this organization
    const existingRole = await db.selectOne<{
      id: string;
    }>('custom_roles', {
      eq: { organization_id: user.organizationId, slug: validatedData.slug },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'Un rôle avec ce slug existe déjà' },
        { status: 400 }
      );
    }

    // Filter and validate permissions (accept any boolean permissions)
    const validatedPermissions: Record<string, boolean> = {};
    Object.keys(validatedData.permissions || {}).forEach(key => {
      if (typeof validatedData.permissions![key] === 'boolean') {
        validatedPermissions[key] = validatedData.permissions![key];
      }
    });

    // Create the custom role
    const newRole = await db.insertOne<{
      id: string;
      organization_id: string;
      name: string;
      slug: string;
      description: string | null;
      color: string;
      permissions: Record<string, boolean>;
      is_active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>('custom_roles', {
      organization_id: user.organizationId,
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description || null,
      color: validatedData.color,
      permissions: validatedPermissions,
      is_active: true,
    });

    if (!newRole) {
      return NextResponse.json(
        { error: 'Failed to create role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newRole.id,
      name: newRole.name,
      slug: newRole.slug,
      description: newRole.description,
      color: newRole.color,
      permissions: newRole.permissions,
      createdAt: newRole.created_at,
      updatedAt: newRole.updated_at,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating custom role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

