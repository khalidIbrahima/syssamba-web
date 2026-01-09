/**
 * Sign In API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

// Rate limiting following Supabase guidelines
// Auth endpoints: 60 requests per minute per IP
const rateLimit = new Map<string, { count: number; resetTime: number; windowMs: number; maxRequests: number }>();

function checkRateLimit(identifier: string, endpoint: 'auth' | 'other' = 'auth'): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Supabase rate limits per endpoint type
  const limits = {
    auth: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute (conservative)
    other: { windowMs: 60 * 1000, maxRequests: 100 }
  };

  const limit = limits[endpoint];
  const key = `${endpoint}:${identifier}`;

  const record = rateLimit.get(key);
  if (!record || now > record.resetTime) {
    rateLimit.set(key, {
      count: 1,
      resetTime: now + limit.windowMs,
      windowMs: limit.windowMs,
      maxRequests: limit.maxRequests
    });
    return { allowed: true };
  }

  if (record.count >= record.maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password } = body;

    // Rate limiting per Supabase guidelines - extract IP from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || cfConnectingIp || 'unknown';

    const identifier = email || phone || clientIp;
    const rateLimitResult = checkRateLimit(identifier, 'auth');

    if (!rateLimitResult.allowed) {
      console.warn(`[Rate Limit] Blocked auth request from ${identifier}, retry after ${rateLimitResult.retryAfter}s`);
      const response = NextResponse.json(
        {
          error: `Trop de tentatives de connexion. Veuillez réessayer dans ${rateLimitResult.retryAfter} secondes.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '60');
      return response;
    }

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

    const supabase = await createRouteHandlerClient(request);

    // Check if user is already signed in
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      // User is already signed in, return success
      return NextResponse.json({
        user: {
          id: currentUser.id,
          email: currentUser.email,
          phone: currentUser.phone,
          firstName: currentUser.user_metadata?.first_name,
          lastName: currentUser.user_metadata?.last_name,
          avatarUrl: currentUser.user_metadata?.avatar_url,
        },
        hasOrganization: false, // Will be checked below
        organizationConfigured: false,
        isSuperAdmin: false,
        alreadySignedIn: true,
      });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email || phone || '',
      password,
    });

    if (error) {
      let errorMessage = 'Erreur de connexion';
      let statusCode = 400;

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email/téléphone ou mot de passe incorrect';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email';
      } else if (error.message.includes('Too many requests') || error.status === 429) {
        errorMessage = 'Trop de tentatives. Veuillez réessayer dans quelques minutes';
        statusCode = 429;
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Limite de taux atteinte. Veuillez patienter avant de réessayer';
        statusCode = 429;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Get or create user in database
    // First try to find by sb_user_id (explicit Supabase link)
    let dbUser = await db.selectOne<{
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
    }>('users', {
      eq: { sb_user_id: data.user.id },
    });

    // Fallback: try by id (for backward compatibility)
    if (!dbUser) {
      dbUser = await db.selectOne<{
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
      }>('users', {
        eq: { id: data.user.id },
      });
    }

    if (!dbUser) {
      // Create new user with sb_user_id
      dbUser = await db.insertOne<{
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
      }>('users', {
        id: data.user.id, // Use Supabase ID as primary key
        sb_user_id: data.user.id, // Explicit Supabase user ID link
        email: data.user.email || null,
        phone: data.user.phone || null,
        first_name: data.user.user_metadata?.first_name || null,
        last_name: data.user.user_metadata?.last_name || null,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        role: 'viewer',
        is_active: true,
        organization_id: null,
      });
    } else if (!dbUser.sb_user_id) {
      // Update existing user to set sb_user_id if missing
      await db.updateOne('users', {
        sb_user_id: data.user.id,
      }, { id: dbUser.id });
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération de l\'utilisateur' },
        { status: 500 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(dbUser.id);

    // Check if user has an organization and if it's configured
    let organizationConfigured = false;
    let organizationSubdomain: string | null = null;
    if (dbUser.organization_id) {
      const organization = await db.selectOne<{
        id: string;
        is_configured: boolean;
        subdomain: string | null;
      }>('organizations', {
        eq: { id: dbUser.organization_id },
      });

      organizationConfigured = organization?.is_configured || false;
      organizationSubdomain = organization?.subdomain || null;
    }

    // Get session to ensure cookies are set
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de la session' },
        { status: 500 }
      );
    }

    // Create response
    // The createRouteHandlerClient already handles cookies automatically
    // We just need to return the response
    const response = NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role,
        organizationId: dbUser.organization_id,
        avatarUrl: dbUser.avatar_url,
        isActive: dbUser.is_active,
      },
      hasOrganization: !!dbUser.organization_id,
      organizationConfigured,
      organizationSubdomain,
      isSuperAdmin: userIsSuperAdmin,
    });

    // The createRouteHandlerClient already sets cookies in the response
    // We don't need to manually copy them
    return response;
  } catch (error: any) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
