'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Settings, Shield, Building, ChevronDown, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';

interface ProfileAvatarProps {
  className?: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  profileName: string | null;
}

// Fetch current user's full data including profile
async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const response = await fetch('/api/user/profile', {
    credentials: 'include',
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function ProfileAvatar({ className }: ProfileAvatarProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Get current user's profile data
  const { data: userProfile, isLoading, refetch } = useDataQuery(
    ['current-user-profile'],
    getCurrentUserProfile
  );

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la déconnexion');
      }

      // Redirect to sign-in
      window.location.href = '/auth/sign-in';
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Erreur lors de la déconnexion');
    } finally {
      setIsSigningOut(false);
    }
  };

  const getUserInitials = () => {
    if (!userProfile) return 'U';

    // Try first name + last name first
    if (userProfile.firstName && userProfile.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
    }

    // Try first name only
    if (userProfile.firstName) {
      return userProfile.firstName[0].toUpperCase();
    }

    // Try last name only
    if (userProfile.lastName) {
      return userProfile.lastName[0].toUpperCase();
    }

    // Fallback to email
    if (userProfile.email) {
      return userProfile.email[0].toUpperCase();
    }

    // Fallback to phone
    if (userProfile.phone) {
      return userProfile.phone[0].toUpperCase();
    }

    return 'U';
  };

  const getUserFullName = () => {
    if (!userProfile) return 'Utilisateur';

    const { firstName, lastName, email, phone } = userProfile;

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else if (email) {
      return email;
    } else if (phone) {
      return phone;
    }
    
    return 'Utilisateur';
  };

  const getRoleDisplay = () => {
    if (!userProfile) return 'Utilisateur';
    
    const roleMap: Record<string, string> = {
      'admin': 'Administrateur',
      'manager': 'Gestionnaire',
      'viewer': 'Lecteur',
      'owner': 'Propriétaire',
    };

    return roleMap[userProfile.role] || 'Utilisateur';
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gray-300 text-muted-foreground animate-pulse">
            ...
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gray-400 text-white">U</AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex items-center gap-3 h-auto p-2 hover:bg-gray-100 hover:shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 rounded-lg cursor-pointer border border-transparent hover:border-gray-200 ${className}`}
        >
          <Avatar className="h-10 w-10">
            {userProfile.avatarUrl ? (
              <AvatarImage
                src={userProfile.avatarUrl}
                alt={getUserFullName()}
              />
            ) : null}
            <AvatarFallback className="bg-blue-600 text-white font-semibold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground">
              {getUserFullName()}
            </span>
            <div className="flex items-center gap-1">
              {userProfile.profileName && (
                <Badge variant="outline" className="text-xs px-2 py-0">
                  <UserCircle className="w-3 h-3 mr-1" />
                  {userProfile.profileName}
                </Badge>
              )}
              {!userProfile.profileName && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  <Shield className="w-3 h-3 mr-1" />
                  {getRoleDisplay()}
                </Badge>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 hidden lg:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none text-foreground">
              {getUserFullName()}
            </p>
            
            {/* Email/Phone */}
            {(userProfile.email || userProfile.phone) && (
              <p className="text-xs leading-none text-muted-foreground">
                {userProfile.email || userProfile.phone}
              </p>
            )}
            
            {/* Profile Name */}
            {userProfile.profileName && (
              <div className="flex items-center gap-1">
                <UserCircle className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs leading-none text-muted-foreground">
                  Profil: {userProfile.profileName}
                </p>
              </div>
            )}
            
            {/* Organization */}
            {userProfile.organizationName && (
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs leading-none text-muted-foreground">
                  {userProfile.organizationName}
                </p>
              </div>
            )}
            
            {/* Role */}
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs leading-none text-muted-foreground">
                Rôle: {getRoleDisplay()}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push('/settings')}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Paramètres du compte</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push('/settings/users')}
            className="cursor-pointer"
          >
            <Building className="mr-2 h-4 w-4" />
            <span>Gestion des utilisateurs</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
