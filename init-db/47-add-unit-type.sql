-- =================================================================
-- Add unit_type column to units table
-- =================================================================
-- This migration adds a unit_type column to categorize units
-- (e.g., Studio, Mini Studio, F3, F4, etc.)

BEGIN;

-- Add unit_type column
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS unit_type TEXT;

-- Note: No check constraint is added here to allow custom unit types
-- Custom types are managed via the unit_types table (see migration 48)

-- Create index for filtering by unit type
CREATE INDEX IF NOT EXISTS idx_units_unit_type 
ON units(unit_type);

-- Add comment
COMMENT ON COLUMN units.unit_type IS 'Type d''unité locative (Studio, Mini Studio, F3, F4, etc.)';

COMMIT;

