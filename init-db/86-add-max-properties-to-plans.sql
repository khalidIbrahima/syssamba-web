-- Add max_properties and max_units columns to plans table
-- max_properties: limits the number of properties (buildings/real estate) per organization
-- max_units: limits the number of units (apartments/lots) per organization

ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_properties INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_units INTEGER;

-- Add comments to the columns
COMMENT ON COLUMN plans.max_properties IS 'Maximum number of properties (buildings/real estate) allowed per organization. NULL means unlimited.';
COMMENT ON COLUMN plans.max_units IS 'Maximum number of units (apartments/lots) allowed per organization. NULL means unlimited.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_max_properties ON plans(max_properties);
CREATE INDEX IF NOT EXISTS idx_plans_max_units ON plans(max_units);

-- Update existing plans with default values (NULL = unlimited)
-- No need to update existing records as they will inherit NULL (unlimited) by default