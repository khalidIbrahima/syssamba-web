/**
 * Supabase Authentication Service for Next.js
 * Handles authentication using Supabase Auth
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { db } from './db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase environment variables not set. Authentication will be disabled.');
}

// Server-side Supabase client
// Note: For server-side usage, we use a read-only client that doesn't modify cookies
// Cookie management is handled by Supabase's built-in cookie handling via headers
export async function createServerSupabaseClient() {
  // Create a client that reads from cookies but doesn't try to write them
  // Supabase will handle cookie management through HTTP headers in route handlers
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: async (key: string) => {
          try {
            const cookieStore = await cookies();
            return cookieStore.get(key)?.value ?? null;
          } catch {
            return null;
          }
        },
        setItem: async (key: string, value: string) => {
          // Don't set cookies in server components - only in route handlers
          // This will be handled by Supabase's auth helpers in route handlers
          console.warn(`[Supabase Auth] Attempted to set cookie ${key} in server component. Use route handlers for auth operations.`);
        },
        removeItem: async (key: string) => {
          // Don't remove cookies in server components - only in route handlers
          console.warn(`[Supabase Auth] Attempted to remove cookie ${key} in server component. Use route handlers for auth operations.`);
        },
      },
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Server-side Supabase client for Route Handlers (can write cookies)
export async function createRouteHandlerSupabaseClient(request?: Request) {
  const cookieStore = await cookies();
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          try {
            return cookieStore.get(key)?.value ?? null;
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            console.log('[Supabase Auth] Setting cookie:', key);
            cookieStore.set(key, value, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7 days
              path: '/',
            });
            console.log('[Supabase Auth] Cookie set successfully:', key);
          } catch (error) {
            console.error('[Supabase Auth] Error setting cookie:', key, error);
          }
        },
        removeItem: (key: string) => {
          try {
            cookieStore.delete(key);
          } catch (error) {
            console.error('Error deleting cookie:', error);
          }
        },
      },
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

// Client-side Supabase client is now in supabase-auth-client.ts
// Import it from there in client components to avoid importing next/headers

// Types
export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  organizationId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface SignInCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface SignUpCredentials {
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Get current authenticated user (server-side)
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  console.error('[getCurrentAuthUser] ===== Function called =====');
  try {
    const supabase = await createServerSupabaseClient();
    console.error('[getCurrentAuthUser] Supabase client created');
    
    // Try to get session first (reads from cookies)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[getCurrentAuthUser] Session error:', sessionError.message);
    }
    
    // If no session, try getUser as fallback
    let user = session?.user;
    let error = sessionError;
    
    if (!user && !sessionError) {
      const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
      user = userData || undefined;
      error = userError;
      
      if (userError) {
        console.error('[getCurrentAuthUser] Auth error:', userError.message);
      }
    }

    if (error || !user) {
      console.log('[getCurrentAuthUser] No user found. Session exists:', !!session);
      return null;
    }
    
    console.log('[getCurrentAuthUser] User found:', user.id);

    // Get user from database by id
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
    }>('users', {
      eq: { id: user.id },
    });

    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role,
        organizationId: dbUser.organization_id,
        avatarUrl: dbUser.avatar_url,
        isActive: dbUser.is_active,
      };
    }

    // User exists in auth but not in database - create profile
    const newUser = await db.insertOne<{
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
      id: user.id,
      sb_user_id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      first_name: user.user_metadata?.first_name || null,
      last_name: user.user_metadata?.last_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: 'owner', // New signups are owners
      is_active: true,
      organization_id: null,
    });

    if (!newUser) return null;

    return {
      id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: newUser.role,
      organizationId: newUser.organization_id,
      avatarUrl: newUser.avatar_url,
      isActive: newUser.is_active,
    };
  } catch (error) {
    console.error('Error getting current auth user:', error);
    return null;
  }
}

/**
 * Sign in with email/phone and password
 */
export async function signIn(credentials: SignInCredentials) {
  try {
    // Use route handler client for auth operations that need to set cookies
    const supabase = await createRouteHandlerSupabaseClient();
    const { email, phone, password } = credentials;

    if (!email && !phone) {
      return { user: null, error: 'Email ou numéro de téléphone requis' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email || phone || '',
      password,
    });

    if (error) {
      let errorMessage = 'Erreur de connexion';
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email/téléphone ou mot de passe incorrect';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email';
      }
      return { user: null, error: errorMessage };
    }

    if (!data.user) {
      return { user: null, error: 'Utilisateur non trouvé' };
    }

    // Sync user with database
    const user = await getCurrentAuthUser();
    return { user, error: null };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { user: null, error: error.message || 'Erreur inattendue lors de la connexion' };
  }
}

/**
 * Sign up with email/phone and password
 */
export async function signUp(credentials: SignUpCredentials) {
  try {
    // Use route handler client for auth operations that need to set cookies
    const supabase = await createRouteHandlerSupabaseClient();
    const { email, phone, password, firstName, lastName } = credentials;

    if (!email && !phone) {
      return { user: null, error: 'Email ou numéro de téléphone requis' };
    }

    console.log('[Supabase Auth] Signing up user:', { email, phone, hasPassword: !!password });

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

    console.log('[Supabase Auth] Sign up response:', { hasUser: !!data.user, hasSession: !!data.session, error: error?.message });

    if (error) {
      let errorMessage = 'Erreur d\'inscription';
      if (error.message.includes('User already registered')) {
        errorMessage = 'Cet email/téléphone est déjà enregistré';
      } else if (error.message.includes('Password should be at least')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      }
      return { user: null, error: errorMessage };
    }

    if (!data.user) {
      return { user: null, error: 'Erreur lors de la création du compte' };
    }

    // Create user profile in database
    if (data.user.id) {
      await db.insertOne('users', {
        id: data.user.id,
        sb_user_id: data.user.id,
        email: email || null,
        phone: phone || null,
        first_name: firstName,
        last_name: lastName,
        role: 'owner', // New signups are owners
        is_active: true,
        organization_id: null,
      });
    }

    // Get complete user data
    const user = await getCurrentAuthUser();
    return { user, error: null };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return { user: null, error: error.message || 'Erreur inattendue lors de l\'inscription' };
  }
}

/**
 * Sign out
 */
export async function signOut() {
  try {
    // Use route handler client for auth operations that need to remove cookies
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: 'Erreur lors de la déconnexion' };
    }

    return { error: null };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return { error: error.message || 'Erreur inattendue lors de la déconnexion' };
  }
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  try {
    // Use route handler client for auth operations
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
    });

    if (error) {
      return { error: 'Erreur lors de l\'envoi de l\'email de réinitialisation' };
    }

    return { error: null };
  } catch (error: any) {
    console.error('Reset password error:', error);
    return { error: error.message || 'Erreur inattendue' };
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  try {
    // Use route handler client for auth operations
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: 'Erreur lors de la mise à jour du mot de passe' };
    }

    return { error: null };
  } catch (error: any) {
    console.error('Update password error:', error);
    return { error: error.message || 'Erreur inattendue' };
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  try {
    // Use route handler client for auth operations
    const supabase = await createRouteHandlerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.url, error: null };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    return { url: null, error: error.message || 'Erreur lors de la connexion Google' };
  }
}

