/**
 * Sign Up API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, firstName, lastName } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email ou numéro de téléphone requis' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom requis' },
        { status: 400 }
      );
    }

    const supabase = await createRouteHandlerClient(request);

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email || phone || '',
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/setup`,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      let errorMessage = 'Erreur d\'inscription';
      if (error.message.includes('User already registered')) {
        errorMessage = 'Cet email/téléphone est déjà enregistré';
      } else if (error.message.includes('Password should be at least')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Erreur lors de la création du compte' },
        { status: 500 }
      );
    }

    // Generate organization name from user's name or email
    const orgName = `${firstName} ${lastName}`.trim() || email?.split('@')[0] || 'My Organization';
    
    // Generate a unique slug and subdomain for the organization
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50); // Limit length

    let slug = baseSlug;
    let subdomain = baseSlug;
    let counter = 1;

    // Ensure both slug and subdomain uniqueness
    while (true) {
      // Check if slug exists
      const existingBySlug = await db.selectOne<{ id: string }>('organizations', {
        eq: { slug },
      });
      
      // Check if subdomain exists
      const existingBySubdomain = await db.selectOne<{ id: string }>('organizations', {
        eq: { subdomain },
      });

      if (!existingBySlug && !existingBySubdomain) break;

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
      name: orgName,
      slug,
      subdomain,
      type: 'individual', // Default type
      country: 'SN', // Default country (Senegal)
      is_configured: false, // Not fully configured yet, user can complete setup later
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'organisation' },
        { status: 500 }
      );
    }

    // Note: We use existing global system profiles instead of creating organization-specific profiles
    // Global profiles (is_global = TRUE, organization_id = NULL) are shared across all organizations

    // Get System Administrator profile ID (global profile)
    const systemAdminProfile = await db.selectOne<{
      id: string;
      name: string;
    }>('profiles', {
      eq: { name: 'System Administrator', is_global: false },
    });

    if (!systemAdminProfile || !systemAdminProfile.id) {
      console.error('[Sign-up] System Administrator profile not found! Cannot assign profile to new user.');
      return NextResponse.json(
        { error: 'System Administrator profile not found. Please contact support.' },
        { status: 500 }
      );
    }

    console.log(`[Sign-up] Found System Administrator profile: ${systemAdminProfile.id}`);

    // Create user profile in database with organization ID
    const dbUser = await db.insertOne<{
      id: string;
      sb_user_id: string | null;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      is_active: boolean;
      profile_id: string | null;
      organization_id: string | null;
    }>('users', {
      id: data.user.id, // Use Supabase ID as primary key
      sb_user_id: data.user.id, // Explicit Supabase user ID link
      email: email || null,
      phone: phone || null,
      first_name: firstName,
      last_name: lastName,
      role: 'owner', // New signups are owners
      is_active: true,
      profile_id: systemAdminProfile.id, // Assign System Administrator profile
      organization_id: organization.id, // Link to created organization
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Erreur lors de la création du profil utilisateur' },
        { status: 500 }
      );
    }

    // Get session if available
    const { data: { session } } = await supabase.auth.getSession();

    const response = NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role,
        organizationId: dbUser.organization_id,
        avatarUrl: null,
        isActive: dbUser.is_active,
      },
      hasSession: !!session,
    });

    // Copy Supabase cookies to response if session exists
    if (session) {
      const cookieStore = await import('next/headers').then(m => m.cookies());
      const allCookies = cookieStore.getAll();
      const supabaseCookies = allCookies.filter(c => c.name.startsWith('sb-'));

      supabaseCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      });
    }

    return response;
  } catch (error: any) {
    console.error('Sign up error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
