-- =====================================================
-- Migration: Add contact information columns to organizations
-- =====================================================
-- This migration adds email, phone, phone2, phone_verified, address, city, postal_code, and state columns
-- to the organizations table for storing organization contact information.

-- Ajouter les colonnes de contact à organizations si elles n'existent pas
DO $$ 
BEGIN
    -- Add email column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'email'
    ) THEN
        ALTER TABLE organizations ADD COLUMN email TEXT;
        COMMENT ON COLUMN organizations.email IS 'Adresse email de l''organisation';
    END IF;
    
    -- Add phone column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'phone'
    ) THEN
        ALTER TABLE organizations ADD COLUMN phone TEXT;
        COMMENT ON COLUMN organizations.phone IS 'Numéro de téléphone principal de l''organisation';
    END IF;
    
    -- Add phone2 column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'phone2'
    ) THEN
        ALTER TABLE organizations ADD COLUMN phone2 TEXT;
        COMMENT ON COLUMN organizations.phone2 IS 'Numéro de téléphone secondaire de l''organisation';
    END IF;
    
    -- Add phone_verified column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'phone_verified'
    ) THEN
        ALTER TABLE organizations ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN organizations.phone_verified IS 'Statut de vérification du numéro de téléphone principal';
    END IF;
    
    -- Add address column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'address'
    ) THEN
        ALTER TABLE organizations ADD COLUMN address TEXT;
        COMMENT ON COLUMN organizations.address IS 'Adresse postale de l''organisation';
    END IF;
    
    -- Add city column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'city'
    ) THEN
        ALTER TABLE organizations ADD COLUMN city TEXT;
        COMMENT ON COLUMN organizations.city IS 'Ville de l''organisation';
    END IF;
    
    -- Add postal_code column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'postal_code'
    ) THEN
        ALTER TABLE organizations ADD COLUMN postal_code TEXT;
        COMMENT ON COLUMN organizations.postal_code IS 'Code postal de l''organisation';
    END IF;
    
    -- Add state column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'state'
    ) THEN
        ALTER TABLE organizations ADD COLUMN state TEXT;
        COMMENT ON COLUMN organizations.state IS 'Région/Province/État de l''organisation';
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON TABLE organizations IS 'Cœur du multi-tenant SAMBA ONE – toutes les limites monétisation sont ici';
