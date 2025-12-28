'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// Using div with overflow instead of ScrollArea for now
import { Send, Loader2, Search, X, Paperclip, Image as ImageIcon, File, X as XIcon } from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useUser } from '@/hooks/use-user';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabaseRealtimeMessages } from '@/hooks/use-supabase-realtime';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { uploadFile, getFilePreview } from '@/lib/file-upload';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
}

interface Message {
  id: string;
  senderId: string | null;
  senderType: string;
  senderName: string | null;
  senderAvatar: string | null;
  content: string;
  attachments: string[];
  readAt: string | null;
  createdAt: string;
}

interface UserMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedUserId?: string | null | undefined;
}

// Fetch users from API
async function getUsers(): Promise<User[]> {
  const response = await fetch('/api/users', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

// Fetch messages between current user and selected user
async function getMessages(currentUserId: string, otherUserId: string): Promise<Message[]> {
  // Get messages in both directions: sent by current user OR sent by other user
  const response = await fetch(`/api/messages?senderUserId=${currentUserId}&recipientUserId=${otherUserId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
}

export function UserMessageDialog({ open, onOpenChange, initialSelectedUserId }: UserMessageDialogProps) {
  const { user: currentUser } = useUser();
  const { user: authUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get current user's database ID
  const { data: currentUserData } = useDataQuery(
    ['current-user'],
    async () => {
      const response = await fetch('/api/user/current', { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    { enabled: open && !!selectedUser }
  );

  const { data: users = [], isLoading } = useDataQuery<User[]>(
    ['users'],
    getUsers,
    { enabled: open }
  );

  // Fetch messages when a user is selected
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useDataQuery<Message[]>(
    ['messages', selectedUser?.id, currentUserData?.id],
    () => {
      if (!selectedUser || !currentUserData) return Promise.resolve([]);
      return getMessages(currentUserData.id, selectedUser.id);
    },
    { enabled: open && !!selectedUser && !!currentUserData }
  );

  // Set up real-time subscription for messages
  useSupabaseRealtimeMessages(currentUserData?.organizationId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select user if initialSelectedUserId is provided
  useEffect(() => {
    if (initialSelectedUserId && users.length > 0 && !selectedUser) {
      const user = users.find((u) => u.id === initialSelectedUserId);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [initialSelectedUserId, users, selectedUser]);

  // Mark messages as read when a user is selected and messages are loaded
  useEffect(() => {
    if (!selectedUser || !currentUserData || messages.length === 0) return;

    const markMessagesAsRead = async () => {
      try {
        // Get unread message IDs
        const unreadMessageIds = messages
          .filter((msg) => !msg.readAt && msg.senderId !== currentUserData.id)
          .map((msg) => msg.id);

        if (unreadMessageIds.length > 0) {
          await fetch('/api/messages/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              messageIds: unreadMessageIds,
            }),
          });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markMessagesAsRead();
  }, [selectedUser, currentUserData, messages]);

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchQuery('');
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const fileArray = Array.from(files);
      const uploadedUrls: string[] = [];

      for (const file of fileArray) {
        try {
          const url = await uploadFile(
            file,
            'messages/attachments',
            currentUserData?.organizationId
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
    if ((!message.trim() && attachments.length === 0) || !selectedUser || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          recipientUserId: selectedUser.id,
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
      // Refetch messages to show the new one
      await refetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setMessage('');
    setSearchQuery('');
    setAttachments([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Envoyer un message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* User List Sidebar */}
          <div className="w-1/3 border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left",
                        selectedUser?.id === user.id && "bg-blue-50 border border-blue-200"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {user.firstName?.[0] || ''}{user.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email || user.role}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Message Compose Area */}
          <div className="flex-1 flex flex-col">
            {selectedUser ? (
              <>
                <div className="p-4 border-b flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatarUrl || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {selectedUser.firstName?.[0] || ''}{selectedUser.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white px-4 py-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-gray-500">Aucun message</p>
                      <p className="text-sm text-gray-400 mt-1">Envoyez le premier message</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((msg) => {
                        const isCurrentUser = msg.senderId === currentUserData?.id;
                        const formatTime = (dateString: string) => {
                          try {
                            const date = parseISO(dateString);
                            if (isToday(date)) {
                              return format(date, 'HH:mm', { locale: fr });
                            } else if (isYesterday(date)) {
                              return `Hier ${format(date, 'HH:mm', { locale: fr })}`;
                            } else {
                              return format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
                            }
                          } catch {
                            return dateString;
                          }
                        };

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2 group",
                              isCurrentUser ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isCurrentUser && (
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={msg.senderAvatar || undefined} />
                                <AvatarFallback className="bg-gray-200 text-gray-700 text-xs">
                                  {msg.senderName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              "flex flex-col",
                              isCurrentUser ? "items-end max-w-[75%]" : "items-start max-w-[75%]"
                            )}>
                              <div className={cn(
                                "relative rounded-2xl px-4 py-2.5 shadow-sm",
                                isCurrentUser
                                  ? "bg-blue-600 text-white rounded-br-md"
                                  : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
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
                                                isCurrentUser
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
                              <span className="text-xs text-gray-500 mt-0.5 px-1">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                            {isCurrentUser && (
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={currentUser?.imageUrl || undefined} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                  {currentUser?.firstName?.[0] || ''}{currentUser?.lastName?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Message Input */}
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
                      className="h-11 w-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white p-0 flex-shrink-0 shadow-lg"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">Sélectionnez un utilisateur pour commencer</p>
                  <p className="text-sm text-gray-400">Choisissez un utilisateur dans la liste à gauche</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

