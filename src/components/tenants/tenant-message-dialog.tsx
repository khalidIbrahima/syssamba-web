'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TenantMessages } from './tenant-messages';

interface TenantMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  organizationId: string;
  tenantName?: string;
}

export function TenantMessageDialog({
  open,
  onOpenChange,
  tenantId,
  organizationId,
  tenantName,
}: TenantMessageDialogProps) {
  if (!tenantId) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>
            Conversation avec {tenantName || 'le locataire'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden min-h-0">
          <TenantMessages tenantId={tenantId} organizationId={organizationId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

