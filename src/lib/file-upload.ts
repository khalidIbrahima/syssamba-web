/**
 * File upload utilities for Supabase Storage
 */

import { supabase } from './supabase';
import { getAuthenticatedSupabase } from './supabase';

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param path - The storage path (e.g., 'messages/attachments')
 * @param organizationId - The organization ID for folder structure
 * @param token - Optional auth token for authenticated uploads
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(
  file: File,
  path: string = 'messages/attachments',
  organizationId?: string,
  token?: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`Le fichier est trop volumineux (max ${maxSize / 1024 / 1024}MB)`);
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = organizationId ? `${path}/${organizationId}/${fileName}` : `${path}/${fileName}`;

  // Use authenticated client if token is provided
  const client = token ? await getAuthenticatedSupabase(token) : supabase;
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Upload file
  const { data, error } = await client.storage
    .from('attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Erreur lors de l'upload: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = client.storage
    .from('attachments')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  path: string = 'messages/attachments',
  organizationId?: string,
  token?: string
): Promise<string[]> {
  const uploadPromises = files.map((file) => uploadFile(file, path, organizationId, token));
  return Promise.all(uploadPromises);
}

/**
 * Get file type icon or preview
 */
export function getFilePreview(fileUrl: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return { type: 'image', url: fileUrl };
  }
  
  if (['pdf'].includes(ext || '')) {
    return { type: 'pdf', url: fileUrl };
  }
  
  if (['doc', 'docx'].includes(ext || '')) {
    return { type: 'document', url: fileUrl };
  }
  
  if (['xls', 'xlsx'].includes(ext || '')) {
    return { type: 'spreadsheet', url: fileUrl };
  }
  
  return { type: 'file', url: fileUrl };
}

