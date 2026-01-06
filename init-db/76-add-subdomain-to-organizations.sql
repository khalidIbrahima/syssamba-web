-- =====================================================
-- Migration: Add subdomain column to organizations
-- Purpose: Enable subdomain routing for each organization
-- Date: 2024
-- =====================================================

-- Add subdomain column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Create index for faster subdomain lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain) 
WHERE subdomain IS NOT NULL;

-- Update existing organizations to use slug as subdomain (if needed)
-- This ensures existing organizations have a subdomain
UPDATE organizations 
SET subdomain = slug 
WHERE subdomain IS NULL 
  AND slug IS NOT NULL;

-- Add constraint to ensure subdomain format is valid
-- Subdomain must be lowercase, alphanumeric with hyphens, 3-63 characters
ALTER TABLE organizations
ADD CONSTRAINT check_subdomain_format 
CHECK (
  subdomain IS NULL OR (
    LENGTH(subdomain) >= 3 AND 
    LENGTH(subdomain) <= 63 AND
    subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  )
);

-- Add comment to column
COMMENT ON COLUMN organizations.subdomain IS 'Unique subdomain for organization (e.g., org-name.syssamba.com)';

