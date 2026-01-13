-- =====================================================
-- Migration: Populate TVA rates for countries table
-- =====================================================

-- Update TVA rates for all countries
-- Rates are based on UEMOA standards (18% for most UEMOA countries) 
-- and national standards for other countries

UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'SN'; -- Sénégal
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'CI'; -- Côte d'Ivoire
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'BF'; -- Burkina Faso
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'BJ'; -- Bénin
UPDATE countries SET tva = 19.25, updated_at = NOW() WHERE code = 'CM'; -- Cameroun
UPDATE countries SET tva = 19.00, updated_at = NOW() WHERE code = 'CF'; -- Centrafrique
UPDATE countries SET tva = 0.00, updated_at = NOW() WHERE code = 'KM'; -- Comores (pas de TVA)
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'CG'; -- Congo
UPDATE countries SET tva = 16.00, updated_at = NOW() WHERE code = 'CD'; -- RDC
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'GA'; -- Gabon
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'GN'; -- Guinée
UPDATE countries SET tva = 15.00, updated_at = NOW() WHERE code = 'GW'; -- Guinée-Bissau
UPDATE countries SET tva = 15.00, updated_at = NOW() WHERE code = 'GQ'; -- Guinée équatoriale
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'ML'; -- Mali
UPDATE countries SET tva = 19.00, updated_at = NOW() WHERE code = 'NE'; -- Niger
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'TD'; -- Tchad
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'TG'; -- Togo

-- Autres pays d'Afrique
UPDATE countries SET tva = 18.00, updated_at = NOW() WHERE code = 'MR'; -- Mauritanie
UPDATE countries SET tva = 12.50, updated_at = NOW() WHERE code = 'GH'; -- Ghana
UPDATE countries SET tva = 7.50, updated_at = NOW() WHERE code = 'NG'; -- Nigeria
