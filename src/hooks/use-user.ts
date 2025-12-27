/**
 * useUser Hook
 * Client-side user data hook
 */

'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  primaryEmailAddress: { emailAddress: string } | null;
  imageUrl: string | null;
  phoneNumbers: Array<{ phoneNumber: string }>;
  primaryPhoneNumber: { phoneNumber: string } | null;
}

export function useUser() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClientClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(mapSupabaseUserToUserData(session.user));
      } else {
        setUser(null);
      }
      setIsLoaded(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapSupabaseUserToUserData(session.user));
      } else {
        setUser(null);
      }
      setIsLoaded(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isLoaded,
  };
}

function mapSupabaseUserToUserData(supabaseUser: User): UserData {
  const email = supabaseUser.email || '';
  return {
    id: supabaseUser.id,
    firstName: supabaseUser.user_metadata?.first_name || null,
    lastName: supabaseUser.user_metadata?.last_name || null,
    emailAddresses: email ? [{ emailAddress: email }] : [],
    primaryEmailAddress: email ? { emailAddress: email } : null,
    imageUrl: supabaseUser.user_metadata?.avatar_url || null,
    phoneNumbers: supabaseUser.phone ? [{ phoneNumber: supabaseUser.phone }] : [],
    primaryPhoneNumber: supabaseUser.phone ? { phoneNumber: supabaseUser.phone } : null,
  };
}
