import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth-helpers';
import { isSuperAdmin } from '@/lib/super-admin';
import { getProfileObjectPermissions } from '@/lib/profiles';
import { db } from '@/lib/db';

/**
 * GET /api/admin/profiles/[profileId]/permissions
 * Get object permissions for a specific profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { userId } = await checkAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userIsSuperAdmin = await isSuperAdmin(userId);
    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Super-admin requis.' },
        { status: 403 }
      );
    }

    const { profileId } = await params;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID requis' },
        { status: 400 }
      );
    }

    // Verify profile exists
    const profile = await db.selectOne<{ id: string }>('profiles', {
      eq: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profil non trouvé' },
        { status: 404 }
      );
    }

    // Get permissions
    const permissions = await getProfileObjectPermissions(profileId);

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error: any) {
    console.error('Error fetching profile permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des permissions' },
      { status: 500 }
    );
  }
}

