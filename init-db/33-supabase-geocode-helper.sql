-- =================================================================
-- SAMBA ONE - Script SQL pour Supabase (sans extension http)
-- Préparation des données pour le géocodage via script TypeScript
-- =================================================================
-- 
-- Ce script prépare les données et fournit des vues utiles pour
-- faciliter le géocodage via le script TypeScript externe.
-- 
-- Usage: Exécutez ce script sur Supabase, puis utilisez:
--   npm run update-geocoordinates -- --all
-- =================================================================

-- Vue pour lister les propriétés sans coordonnées (pour le script TypeScript)
CREATE OR REPLACE VIEW properties_missing_coordinates AS
SELECT 
    id,
    name,
    address,
    city,
    organization_id,
    created_at,
    CASE 
        WHEN latitude IS NULL AND longitude IS NULL THEN 'Les deux manquants'
        WHEN latitude IS NULL THEN 'Latitude manquante'
        WHEN longitude IS NULL THEN 'Longitude manquante'
        ELSE 'Complet'
    END AS status
FROM properties
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY created_at DESC;

COMMENT ON VIEW properties_missing_coordinates IS 
'Vue listant toutes les propriétés qui nécessitent un géocodage. Utilisée par le script TypeScript update-geocoordinates.ts';

-- Vue pour les statistiques de géolocalisation
CREATE OR REPLACE VIEW properties_geolocation_stats AS
SELECT 
    COUNT(*) AS total_properties,
    COUNT(latitude) AS with_latitude,
    COUNT(longitude) AS with_longitude,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS with_both_coords,
    COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) AS missing_coords,
    ROUND(
        (COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::DECIMAL / 
         NULLIF(COUNT(*), 0)) * 100, 
        2
    ) AS completion_percentage
FROM properties;

COMMENT ON VIEW properties_geolocation_stats IS 
'Statistiques sur l''état du géocodage des propriétés';

-- Fonction pour obtenir les propriétés à géocoder (pour le script TypeScript)
CREATE OR REPLACE FUNCTION get_properties_to_geocode(
    limit_count INTEGER DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    address TEXT,
    city TEXT,
    organization_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.address,
        p.city,
        p.organization_id
    FROM properties p
    WHERE p.latitude IS NULL OR p.longitude IS NULL
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_properties_to_geocode IS 
'Retourne la liste des propriétés nécessitant un géocodage. Utilisée par le script TypeScript.';

-- Fonction pour mettre à jour les coordonnées (appelée par le script TypeScript)
CREATE OR REPLACE FUNCTION update_property_geocoordinates(
    property_uuid UUID,
    lat DECIMAL,
    lon DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE properties
    SET 
        latitude = lat::TEXT,
        longitude = lon::TEXT
    WHERE id = property_uuid
    RETURNING id INTO updated_count;
    
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_property_geocoordinates IS 
'Met à jour les coordonnées d''une propriété. Utilisée par le script TypeScript update-geocoordinates.ts';

-- Fonction pour vérifier l'état du géocodage par organisation
CREATE OR REPLACE FUNCTION get_geocoding_status_by_organization()
RETURNS TABLE(
    organization_id UUID,
    organization_name TEXT,
    total_properties INTEGER,
    properties_with_coords INTEGER,
    properties_missing_coords INTEGER,
    completion_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id AS organization_id,
        o.name AS organization_name,
        COUNT(p.id) AS total_properties,
        COUNT(*) FILTER (WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL) AS properties_with_coords,
        COUNT(*) FILTER (WHERE p.latitude IS NULL OR p.longitude IS NULL) AS properties_missing_coords,
        ROUND(
            (COUNT(*) FILTER (WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL)::DECIMAL / 
             NULLIF(COUNT(p.id), 0)) * 100, 
            2
        ) AS completion_percentage
    FROM organizations o
    LEFT JOIN properties p ON p.organization_id = o.id
    GROUP BY o.id, o.name
    ORDER BY completion_percentage ASC, o.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_geocoding_status_by_organization IS 
'Retourne les statistiques de géocodage par organisation';

-- Afficher les propriétés sans coordonnées
SELECT 
    COUNT(*) AS total_missing,
    COUNT(DISTINCT organization_id) AS organizations_affected
FROM properties
WHERE latitude IS NULL OR longitude IS NULL;

-- Afficher les statistiques globales
SELECT * FROM properties_geolocation_stats;

-- Instructions pour Supabase
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Script Supabase - Préparation terminée';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Vues créées:';
    RAISE NOTICE '  - properties_missing_coordinates';
    RAISE NOTICE '  - properties_geolocation_stats';
    RAISE NOTICE '';
    RAISE NOTICE 'Fonctions créées:';
    RAISE NOTICE '  - get_properties_to_geocode(limit_count)';
    RAISE NOTICE '  - update_property_geocoordinates(uuid, lat, lon)';
    RAISE NOTICE '  - get_geocoding_status_by_organization()';
    RAISE NOTICE '';
    RAISE NOTICE 'Pour géocoder les propriétés, exécutez:';
    RAISE NOTICE '  npm run update-geocoordinates -- --all';
    RAISE NOTICE '';
    RAISE NOTICE 'Pour vérifier l''état:';
    RAISE NOTICE '  SELECT * FROM properties_geolocation_stats;';
    RAISE NOTICE '  SELECT * FROM properties_missing_coordinates;';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

