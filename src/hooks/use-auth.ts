/**
 * useAuth Hook
 * Client-side authentication hook
 */

'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Global auth state to prevent multiple simultaneous auth checks
let globalAuthState: { user: User | null; isLoaded: boolean; timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 30000; // 30 seconds - auth state changes frequently

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClientClient();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check global cache first
        const now = Date.now();
        if (globalAuthState && (now - globalAuthState.timestamp) < AUTH_CACHE_DURATION && mounted) {
          setUser(globalAuthState.user);
          setIsLoaded(globalAuthState.isLoaded);
          return;
        }

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('[useAuth] Session error:', error);
          setUser(null);
          setIsLoaded(true);
          globalAuthState = { user: null, isLoaded: true, timestamp: now };
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsLoaded(true);

        // Update global cache
        globalAuthState = { user: currentUser, isLoaded: true, timestamp: now };

      } catch (error) {
        console.error('[useAuth] Initialization error:', error);
        if (mounted) {
          setUser(null);
          setIsLoaded(true);
        }
      }
    };

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Update global cache
      globalAuthState = { user: currentUser, isLoaded: true, timestamp: Date.now() };
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Clear global cache
    globalAuthState = { user: null, isLoaded: true, timestamp: Date.now() };
  };

  return {
    user,
    userId: user?.id || null,
    isLoaded,
    isSignedIn: !!user,
    signOut,
  };
}
