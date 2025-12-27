'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Paperclip, Smile, Check, CheckCheck, MessageSquare, Image as ImageIcon, File, X as XIcon } from 'lucide-react';
import { useSupabaseRealtimeMessages } from '@/hooks/use-supabase-realtime';
import { useDataQuery } from '@/hooks/use-query';
import { useUser } from '@/hooks/use-user';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { uploadFile, getFilePreview } from '@/lib/file-upload';

interface Message {
  id: string;
  senderId: string | null;
  senderType: string;
  senderName: string | null;
  senderAvatar: string | null;
  tenantId: string | null;
  tenantName: string | null;
  content: string;
  attachments: string[];
  readAt: string | null;
  createdAt: string;
}

interface TenantMessagesProps {
  tenantId: string;
  organizationId: string;
}

// Fetch messages for a specific tenant
async function getTenantMessages(tenantId: string) {
  const response = await fetch(`/api/messages?tenantId=${tenantId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
}

export function TenantMessages({ tenantId, organizationId }: TenantMessagesProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch messages
  const { data: messages = [], isLoading, refetch } = useDataQuery<Message[]>(
    ['messages', tenantId],
    () => getTenantMessages(tenantId)
  );

  // Set up real-time subscription
  useSupabaseRealtimeMessages(organizationId, tenantId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const token = await getToken();
      const fileArray = Array.from(files);
      const uploadedUrls: string[] = [];

      for (const file of fileArray) {
        try {
          const url = await uploadFile(
            file,
            'messages/attachments',
            organizationId,
            token || undefined
          );
          uploadedUrls.push(url);
        } catch (error) {
          console.error('Error uploading file:', error);
          alert(error instanceof Error ? error.message : 'Erreur lors de l\'upload du fichier');
        }
      }

      setAttachments((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error('Error handling file upload:', error);
      alert('Erreur lors de l\'upload des fichiers');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          content: message.trim() || '',
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      setMessage('');
      setAttachments([]);
      // Refetch messages to get the new one
      await refetch();
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      
      if (isToday(date)) {
        return format(date, 'HH:mm', { locale: fr });
      } else if (isYesterday(date)) {
        return `Hier ${format(date, 'HH:mm', { locale: fr })}`;
      } else {
        const daysDiff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
          return format(date, 'EEEE HH:mm', { locale: fr });
        } else {
          return format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
        }
      }
    } catch {
      return dateString;
    }
  };

  const formatDateHeader = (dateString: string, prevDateString?: string) => {
    try {
      const date = parseISO(dateString);
      const prevDate = prevDateString ? parseISO(prevDateString) : null;
      
      if (prevDate) {
        const sameDay = format(date, 'yyyy-MM-dd') === format(prevDate, 'yyyy-MM-dd');
        if (sameDay) return null;
      }
      
      if (isToday(date)) {
        return "Aujourd'hui";
      } else if (isYesterday(date)) {
        return 'Hier';
      } else {
        const daysDiff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
          return format(date, 'EEEE d MMMM', { locale: fr });
        } else {
          return format(date, 'd MMMM yyyy', { locale: fr });
        }
      }
    } catch {
      return null;
    }
  };

  // Filter messages for this tenant
  const tenantMessages = messages.filter((msg) => msg.tenantId === tenantId);

  return (
    <Card className="h-full flex flex-col p-0 overflow-hidden">
      {/* Header */}
      <CardHeader className="border-b bg-white px-4 py-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversation
        </CardTitle>
      </CardHeader>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tenantMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Aucun message</p>
            <p className="text-sm text-gray-500 mt-1">Envoyez le premier message pour commencer la conversation</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tenantMessages.map((msg, index) => {
              const isStaff = msg.senderType === 'staff';
              const isCurrentUser = isStaff && msg.senderId === user?.id;
              const prevMessage = index > 0 ? tenantMessages[index - 1] : null;
              const dateHeader = formatDateHeader(msg.createdAt, prevMessage?.createdAt);
              const showAvatar = !prevMessage || prevMessage.senderType !== msg.senderType || 
                (new Date(msg.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()) > 300000; // 5 minutes

              return (
                <div key={msg.id}>
                  {/* Date Header */}
                  {dateHeader && (
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                        <span className="text-xs font-medium text-gray-600">{dateHeader}</span>
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex gap-2 group",
                      isStaff ? "justify-end" : "justify-start",
                      showAvatar ? "mt-4" : "mt-1"
                    )}
                  >
                    {/* Avatar (left side for tenant messages) */}
                    {!isStaff && (
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8 ring-2 ring-white">
                            <AvatarImage src={msg.senderAvatar || undefined} />
                            <AvatarFallback className="bg-gray-200 text-gray-700 text-xs font-medium">
                              {msg.tenantName
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase() || 'T'}
                          </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    )}

                    {/* Message Content */}
                    <div className={cn(
                      "flex flex-col",
                      isStaff ? "items-end max-w-[75%]" : "items-start max-w-[75%]"
                    )}>
                      {/* Sender Name (only for tenant messages, first in group) */}
                      {!isStaff && showAvatar && msg.tenantName && (
                        <span className="text-xs font-medium text-gray-600 mb-1 px-1">
                          {msg.tenantName}
                        </span>
                      )}

                      {/* Message Bubble */}
                      <div className={cn(
                        "relative rounded-2xl px-4 py-2.5 shadow-sm",
                        isStaff
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-md",
                        "hover:shadow-md transition-shadow"
                      )}>
                        {msg.content && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={cn("mt-2 space-y-2", msg.content && "mt-2")}>
                            {msg.attachments.map((attachment, idx) => {
                              const preview = getFilePreview(attachment, attachment.split('/').pop() || 'file');
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  {preview.type === 'image' ? (
                                    <a
                                      href={attachment}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block rounded-lg overflow-hidden max-w-[200px]"
                                    >
                                      <img
                                        src={attachment}
                                        alt={`Attachment ${idx + 1}`}
                                        className="max-h-32 object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={attachment}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg border",
                                        isStaff
                                          ? "bg-blue-500/20 border-blue-400/50 text-white"
                                          : "bg-gray-100 border-gray-300 text-gray-900"
                                      )}
                                    >
                                      <File className="h-4 w-4" />
                                      <span className="text-xs truncate max-w-[150px]">
                                        {attachment.split('/').pop()}
                                      </span>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Timestamp and Status */}
                      <div className={cn(
                        "flex items-center gap-1.5 mt-0.5 px-1",
                        isStaff ? "flex-row-reverse" : ""
                      )}>
                        <span className="text-xs text-gray-500">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {isStaff && (
                          <div className="flex items-center">
                            {msg.readAt ? (
                              <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avatar (right side for staff messages) */}
                    {isStaff && (
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8 ring-2 ring-white">
                            <AvatarImage src={msg.senderAvatar || undefined} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
                              {msg.senderName
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase() || 'U'}
                          </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input Area */}
      <div className="border-t bg-white px-4 py-3">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, idx) => {
              const preview = getFilePreview(attachment, attachment.split('/').pop() || 'file');
              return (
                <div key={idx} className="relative group">
                  {preview.type === 'image' ? (
                    <div className="relative">
                      <img
                        src={attachment}
                        alt={`Attachment ${idx + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-lg border border-gray-200">
                      <File className="h-4 w-4 text-gray-600" />
                      <span className="text-xs text-gray-700 max-w-[100px] truncate">
                        {attachment.split('/').pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon className="h-2 w-2" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tapez un message..."
              className="min-h-[44px] max-h-32 resize-none pr-20 rounded-2xl border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploadingFiles}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                className="h-7 w-7 p-0 hover:bg-gray-200 rounded-full"
                title="Joindre un fichier"
              >
                {uploadingFiles ? (
                  <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4 text-gray-500" />
                )}
              </Button>
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          </div>
          <Button
            type="submit"
            disabled={(!message.trim() && attachments.length === 0) || isSending}
            className="h-11 w-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white p-0 flex-shrink-0 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}

