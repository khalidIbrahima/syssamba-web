-- =================================================================
-- Create custom unit types table for organizations
-- =================================================================
-- This allows organizations to define their own unit types
-- in addition to the standard ones

BEGIN;

-- Create unit_types table for custom types per organization
CREATE TABLE IF NOT EXISTS unit_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL, -- URL-friendly identifier
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique slug per organization
    UNIQUE(organization_id, slug)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_unit_types_org ON unit_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_unit_types_active ON unit_types(organization_id, is_active);

-- Add comment
COMMENT ON TABLE unit_types IS 'Types d''unités personnalisés par organisation';
COMMENT ON COLUMN unit_types.slug IS 'Identifiant unique URL-friendly (ex: studio-luxe, f3-renove)';

-- Modify units table to allow any text value (not just enum)
-- Drop the check constraint if it exists
ALTER TABLE units
DROP CONSTRAINT IF EXISTS units_unit_type_check;

-- Now unit_type can be either a standard type or a custom type slug
-- Standard types: studio, mini_studio, f1, f2, f3, f4, f5, f6, duplex, triplex, villa, maison, appartement, bureau, commerce, entrepot, bureau_collectif, atelier, autre
-- Custom types: any slug from unit_types table

COMMIT;

