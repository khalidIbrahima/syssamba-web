/**
 * User Profile API
 * Returns the current user's full profile information
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient(request);

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Get user from database
    const dbUser = await db.selectOne<{
      id: string;
      sb_user_id: string | null;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      organization_id: string | null;
      profile_id: string | null;
    }>('users', {
      eq: { sb_user_id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Get organization name if user has an organization
    let organizationName = null;
    if (dbUser.organization_id) {
      try {
        const organization = await db.selectOne<{
          id: string;
          name: string | null;
        }>('organizations', {
          eq: { id: dbUser.organization_id },
        });
        organizationName = organization?.name || null;
      } catch (error) {
        console.warn('Error fetching organization name:', error);
      }
    }

    // Get profile name if user has a profile
    let profileName = null;
    if (dbUser.profile_id) {
      try {
        const profile = await db.selectOne<{
          id: string;
          name: string | null;
        }>('profiles', {
          eq: { id: dbUser.profile_id },
        });
        profileName = profile?.name || null;
      } catch (error) {
        console.warn('Error fetching profile name:', error);
      }
    }

    return NextResponse.json({
      id: dbUser.id,
      email: dbUser.email,
      phone: dbUser.phone,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      avatarUrl: dbUser.avatar_url,
      role: dbUser.role,
      organizationId: dbUser.organization_id,
      organizationName,
      profileName,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

