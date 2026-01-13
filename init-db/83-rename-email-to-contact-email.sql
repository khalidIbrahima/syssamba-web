-- =====================================================
-- Migration: Rename email column to contact_email in organizations
-- =====================================================
-- This migration renames the email column to contact_email in the organizations table
-- for better clarity and consistency.

-- Rename email column to contact_email if it exists
DO $$ 
BEGIN
    -- Check if email column exists and contact_email doesn't exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'email'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'contact_email'
    ) THEN
        ALTER TABLE organizations RENAME COLUMN email TO contact_email;
        COMMENT ON COLUMN organizations.contact_email IS 'Adresse email de contact de l''organisation';
    -- If email doesn't exist but contact_email also doesn't exist, create contact_email
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'email'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'contact_email'
    ) THEN
        ALTER TABLE organizations ADD COLUMN contact_email TEXT;
        COMMENT ON COLUMN organizations.contact_email IS 'Adresse email de contact de l''organisation';
    END IF;
END $$;
