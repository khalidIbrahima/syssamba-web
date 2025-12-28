'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Settings, Shield, Building } from 'lucide-react';
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
import { useUser } from '@/hooks/use-user';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

interface ProfileAvatarProps {
  className?: string;
}

export function ProfileAvatar({ className }: ProfileAvatarProps) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      router.push('/auth/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';

    const firstInitial = user.firstName?.[0] || '';
    const lastInitial = user.lastName?.[0] || '';
    const emailInitial = user.primaryEmailAddress?.emailAddress?.[0] || '';

    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    } else if (firstInitial) {
      return firstInitial;
    } else if (lastInitial) {
      return lastInitial;
    } else {
      return emailInitial.toUpperCase();
    }
  };

  const getUserFullName = () => {
    if (!user) return 'Utilisateur';

    const firstName = user.firstName;
    const lastName = user.lastName;

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      return user.primaryEmailAddress?.emailAddress || 'Utilisateur';
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="h-10 w-10">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex items-center gap-3 h-auto p-2 hover:bg-gray-100 rounded-lg ${className}`}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.imageUrl || undefined}
              alt={getUserFullName()}
            />
            <AvatarFallback className="bg-blue-600 text-white font-semibold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col items-start">
            <span className="text-sm font-medium text-gray-900">
              {getUserFullName()}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs px-2 py-0">
                <Shield className="w-3 h-3 mr-1" />
                Utilisateur
              </Badge>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {getUserFullName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
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
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
