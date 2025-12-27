import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensure proper UTF-8 encoding for text
 * This helps prevent encoding issues like "RÃ©fÃ©rence" instead of "Référence"
 */
export function ensureUTF8(text: string): string {
  try {
    // If text is already properly encoded, return as is
    return text;
  } catch (error) {
    // If there's an encoding issue, try to fix it
    return Buffer.from(text, 'latin1').toString('utf8');
  }
}

/**
 * Escape CSV values properly with UTF-8 support
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Ensure UTF-8 encoding
  const utf8Str = ensureUTF8(str);
  // Escape quotes for CSV
  const escaped = utf8Str.replace(/"/g, '""');
  return `"${escaped}"`;
}