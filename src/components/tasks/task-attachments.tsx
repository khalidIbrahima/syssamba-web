'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Download,
  Image as ImageIcon,
  File,
  X,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { getFilePreview } from '@/lib/file-upload';
import { cn } from '@/lib/utils';

interface TaskAttachmentsProps {
  attachments: string[];
  className?: string;
}

export function TaskAttachments({ attachments, className }: TaskAttachmentsProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'file' | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handlePreview = (url: string) => {
    const fileName = url.split('/').pop() || url;
    const preview = getFilePreview(url, fileName);
    setPreviewType(preview.type as 'image' | 'pdf' | 'file');
    setPreviewUrl(url);
  };

  const handleDownload = (url: string) => {
    const fileName = url.split('/').pop() || 'attachment';
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (url: string) => {
    const fileName = url.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const preview = getFilePreview(url, fileName);

    if (preview.type === 'image') {
      return <ImageIcon className="h-5 w-5 text-blue-600" />;
    }
    if (preview.type === 'pdf') {
      return <FileText className="h-5 w-5 text-red-600" />;
    }
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getFileTypeLabel = (url: string) => {
    const fileName = url.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
    return ext;
  };

  const canPreview = (url: string) => {
    const fileName = url.split('/').pop() || '';
    const preview = getFilePreview(url, fileName);
    return preview.type === 'image' || preview.type === 'pdf';
  };

  return (
    <>
      <div className={cn('space-y-2', className)}>
        {attachments.map((attachment, index) => {
          const fileName = attachment.split('/').pop() || `Pièce jointe ${index + 1}`;
          const canPreviewFile = canPreview(attachment);

          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(attachment)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getFileTypeLabel(attachment)} • {canPreviewFile ? 'Visualisable' : 'Téléchargeable'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPreviewFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePreview(attachment)}
                    title="Visualiser"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(attachment)}
                  title="Télécharger"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(attachment, '_blank')}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>
                {previewUrl ? previewUrl.split('/').pop() : 'Aperçu'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewUrl && handleDownload(previewUrl)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
            {previewType === 'image' && previewUrl && (
              <div className="flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    console.error('Error loading image:', previewUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {previewType === 'pdf' && previewUrl && (
              <div className="w-full h-[70vh]">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="PDF Preview"
                />
              </div>
            )}
            {previewType === 'file' && previewUrl && (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Ce type de fichier ne peut pas être prévisualisé
                </p>
                <Button onClick={() => handleDownload(previewUrl)}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger le fichier
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

