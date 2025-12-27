'use client';

import { Lock } from 'lucide-react';
import { toast } from 'sonner';

interface AccessDeniedActionProps {
  children: React.ReactNode;
  featureName?: string;
  requiredPlan?: string;
  requiredPermission?: string;
  reason?: 'plan' | 'permission' | 'both';
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function AccessDeniedAction({
  children,
  featureName,
  requiredPlan,
  requiredPermission,
  reason = 'plan',
  disabled = true,
  className,
  title,
}: AccessDeniedActionProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let message = 'Accès non autorisé.';
    
    if (reason === 'plan' && requiredPlan) {
      message = `Cette fonctionnalité nécessite un plan ${requiredPlan}.`;
    } else if (reason === 'permission' && requiredPermission) {
      message = `Vous n'avez pas la permission "${requiredPermission}" pour effectuer cette action.`;
    } else if (reason === 'both') {
      if (requiredPlan && requiredPermission) {
        message = `Cette fonctionnalité nécessite un plan ${requiredPlan} et la permission "${requiredPermission}".`;
      } else if (requiredPlan) {
        message = `Cette fonctionnalité nécessite un plan ${requiredPlan}.`;
      } else if (requiredPermission) {
        message = `Vous n'avez pas la permission "${requiredPermission}".`;
      }
    }
    
    if (featureName) {
      message = `${featureName}: ${message}`;
    }
    
    toast.error(message, {
      duration: 5000,
      action: requiredPlan ? {
        label: 'Voir les plans',
        onClick: () => {
          window.location.href = '/settings/subscription';
        },
      } : undefined,
    });
  };

  const tooltipTitle = title || (() => {
    if (reason === 'plan' && requiredPlan) {
      return `Nécessite un plan ${requiredPlan}`;
    } else if (reason === 'permission' && requiredPermission) {
      return `Permission requise: ${requiredPermission}`;
    } else if (reason === 'both') {
      const parts: string[] = [];
      if (requiredPlan) parts.push(`Plan ${requiredPlan}`);
      if (requiredPermission) parts.push(`Permission: ${requiredPermission}`);
      return parts.join(' et ');
    }
    return 'Accès non autorisé';
  })();

  return (
    <div
      onClick={handleClick}
      className={className}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      title={tooltipTitle}
    >
      {children}
    </div>
  );
}
