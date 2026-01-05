-- =====================================================
-- Migration: Add yearly_discount_rate column to plans
-- Purpose: Allow calculating yearly price from monthly price with discount
-- Date: 2024
-- =====================================================

-- Add yearly_discount_rate column to plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS yearly_discount_rate DECIMAL(5, 2);

-- Add comment to column
COMMENT ON COLUMN plans.yearly_discount_rate IS 'Taux de remise en pourcentage pour le calcul du prix annuel (ex: 20 pour 20% de remise). Si défini, yearly_price = monthly_price * 12 * (1 - discount_rate/100)';

-- Create index for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_plans_yearly_discount_rate ON plans(yearly_discount_rate) 
WHERE yearly_discount_rate IS NOT NULL;

