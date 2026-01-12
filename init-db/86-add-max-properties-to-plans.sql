-- Add max_properties column to plans table
-- This limits the number of properties (buildings/real estate) per organization

ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_properties INTEGER;

-- Add comment to the column
COMMENT ON COLUMN plans.max_properties IS 'Maximum number of properties (buildings/real estate) allowed per organization. NULL means unlimited.';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_plans_max_properties ON plans(max_properties);

-- Update existing plans with default values (NULL = unlimited)
-- No need to update existing records as they will inherit NULL (unlimited) by default