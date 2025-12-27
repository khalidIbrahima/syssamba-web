/**
 * ProfileAccessBadge Component
 * Displays user's profile access level badge
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { useProfileAccessLevel } from '@/hooks/use-profile-access-level';
import { getAccessLevelDescription } from '@/lib/security/profile-access-level';
import type { AccessLevel } from '@/lib/security/profile-access-level';
import { Shield, Lock, Eye, Edit, Trash2 } from 'lucide-react';

interface ProfileAccessBadgeProps {
  showDetails?: boolean;
  className?: string;
}

const accessLevelColors: Record<AccessLevel, string> = {
  None: 'bg-gray-100 text-gray-600',
  Read: 'bg-blue-100 text-blue-700',
  ReadWrite: 'bg-green-100 text-green-700',
  All: 'bg-purple-100 text-purple-700',
};

const accessLevelIcons: Record<AccessLevel, typeof Shield> = {
  None: Lock,
  Read: Eye,
  ReadWrite: Edit,
  All: Shield,
};

export function ProfileAccessBadge({ showDetails = false, className = '' }: ProfileAccessBadgeProps) {
  const { overallAccessLevel, profileName, isLoading } = useProfileAccessLevel();

  if (isLoading) {
    return (
      <Badge variant="outline" className={className}>
        Chargement...
      </Badge>
    );
  }

  const Icon = accessLevelIcons[overallAccessLevel];
  const colorClass = accessLevelColors[overallAccessLevel];
  const description = getAccessLevelDescription(overallAccessLevel);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge className={colorClass}>
        <Icon className="h-3 w-3 mr-1" />
        {overallAccessLevel}
      </Badge>
      {showDetails && (
        <span className="text-sm text-gray-600">
          {profileName && `${profileName} - `}
          {description}
        </span>
      )}
    </div>
  );
}

