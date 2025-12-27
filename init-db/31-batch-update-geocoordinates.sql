-- =================================================================
-- SAMBA ONE - Script SQL pour mettre à jour les coordonnées géographiques
-- 
-- ATTENTION: Ce script nécessite l'extension PostgreSQL http ou un script externe
-- pour appeler l'API Nominatim. Pour une solution plus simple, utilisez le script
-- TypeScript: npm run update-geocoordinates -- --all
-- 
-- Ce script SQL montre comment mettre à jour les coordonnées manuellement
-- ou via une fonction PostgreSQL si l'extension http est disponible.
-- =================================================================

-- Option 1: Mise à jour manuelle des coordonnées
-- Exemple pour un bien spécifique (remplacez les valeurs)
/*
UPDATE properties 
SET 
    latitude = 14.7167,  -- Latitude de Dakar (exemple)
    longitude = -17.4677  -- Longitude de Dakar (exemple)
WHERE id = 'VOTRE_UUID_ICI';
*/

-- Option 2: Fonction PostgreSQL pour géocoder via API (nécessite l'extension http)
-- Décommentez si vous avez installé l'extension pg_http
/*
CREATE OR REPLACE FUNCTION geocode_property(property_uuid UUID)
RETURNS TABLE(lat DECIMAL, lon DECIMAL) AS $$
DECLARE
    prop_address TEXT;
    prop_city TEXT;
    geocode_url TEXT;
    response JSONB;
BEGIN
    -- Récupérer l'adresse du bien
    SELECT address, city INTO prop_address, prop_city
    FROM properties
    WHERE id = property_uuid;
    
    IF prop_address IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', property_uuid;
    END IF;
    
    -- Construire l'URL de géocodage
    geocode_url := 'https://nominatim.openstreetmap.org/search?format=json&q=' || 
                   encode(prop_address || COALESCE(', ' || prop_city, ''), 'escape');
    
    -- Appeler l'API (nécessite pg_http)
    SELECT content::JSONB INTO response
    FROM http_get(geocode_url);
    
    -- Extraire les coordonnées
    IF response IS NOT NULL AND jsonb_array_length(response) > 0 THEN
        SELECT 
            (response->0->>'lat')::DECIMAL,
            (response->0->>'lon')::DECIMAL
        INTO lat, lon;
        
        RETURN QUERY SELECT lat, lon;
    ELSE
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;
*/

-- Option 3: Mise à jour par lot (batch update)
-- Utilisez ce script pour mettre à jour plusieurs biens à la fois
-- Remplacez les valeurs par les coordonnées réelles obtenues via le script TypeScript

-- Exemple de mise à jour pour plusieurs biens:
/*
UPDATE properties 
SET 
    latitude = CASE 
        WHEN name = 'Résidence Les Almadies' THEN 14.7167
        WHEN name = 'Villa Ouakam' THEN 14.7233
        WHEN name = 'Appartement Plateau' THEN 14.6928
        ELSE latitude
    END,
    longitude = CASE 
        WHEN name = 'Résidence Les Almadies' THEN -17.4677
        WHEN name = 'Villa Ouakam' THEN -17.4833
        WHEN name = 'Appartement Plateau' THEN -17.4467
        ELSE longitude
    END
WHERE name IN ('Résidence Les Almadies', 'Villa Ouakam', 'Appartement Plateau');
*/

-- Option 4: Vérifier les biens sans coordonnées
-- Utilisez cette requête pour voir quels biens ont besoin de coordonnées
/*
SELECT 
    id,
    name,
    address,
    city,
    CASE 
        WHEN latitude IS NULL OR longitude IS NULL THEN '❌ Coordonnées manquantes'
        ELSE '✅ Coordonnées présentes'
    END AS status_geoloc
FROM properties
ORDER BY 
    CASE WHEN latitude IS NULL OR longitude IS NULL THEN 0 ELSE 1 END,
    name;
*/

-- Option 5: Statistiques sur les coordonnées
/*
SELECT 
    COUNT(*) AS total_properties,
    COUNT(latitude) AS with_latitude,
    COUNT(longitude) AS with_longitude,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS with_both_coords,
    COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) AS missing_coords
FROM properties;
*/

-- Note importante:
-- Pour une mise à jour automatique, utilisez le script TypeScript:
-- npm run update-geocoordinates -- --all
--
-- Ce script SQL est fourni pour référence et mises à jour manuelles ponctuelles.

