-- =================================================================
-- SAMBA ONE - Script SQL pour géocoder automatiquement les propriétés
-- Remplit les coordonnées latitude/longitude à partir des adresses
-- 
-- ⚠️ IMPORTANT POUR SUPABASE:
-- L'extension PostgreSQL http n'est PAS disponible sur Supabase
-- pour des raisons de sécurité.
-- 
-- ✅ SOLUTION RECOMMANDÉE POUR SUPABASE:
-- Utilisez le script TypeScript qui utilise directement l'API Supabase:
--   npm run update-geocoordinates -- --all
-- 
-- Ce script SQL est fourni pour référence et pour les instances PostgreSQL
-- autonomes qui ont l'extension http installée.
-- =================================================================

-- Vérifier si l'extension http est disponible
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
        RAISE WARNING '═══════════════════════════════════════════════════════════';
        RAISE WARNING 'Extension http non disponible sur cette instance.';
        RAISE WARNING '';
        RAISE WARNING 'Pour Supabase, utilisez le script TypeScript:';
        RAISE WARNING '  npm run update-geocoordinates -- --all';
        RAISE WARNING '';
        RAISE WARNING 'Pour PostgreSQL autonome, installez l''extension:';
        RAISE WARNING '  CREATE EXTENSION IF NOT EXISTS http;';
        RAISE WARNING '═══════════════════════════════════════════════════════════';
    ELSE
        RAISE NOTICE '✓ Extension http détectée. Les fonctions de géocodage sont disponibles.';
    END IF;
END $$;

-- Fonction pour géocoder une adresse via l'API Nominatim
CREATE OR REPLACE FUNCTION geocode_address(
    address_text TEXT,
    city_text TEXT DEFAULT NULL
)
RETURNS TABLE(latitude DECIMAL, longitude DECIMAL) AS $$
DECLARE
    full_address TEXT;
    geocode_url TEXT;
    response JSONB;
    rate_limit_delay INTERVAL := '1 second'; -- Respecter la limite de 1 requête/seconde
BEGIN
    -- Construire l'adresse complète
    full_address := address_text;
    IF city_text IS NOT NULL AND city_text != '' THEN
        full_address := full_address || ', ' || city_text;
    END IF;
    
    -- Construire l'URL de géocodage (avec encodage URL)
    geocode_url := 'https://nominatim.openstreetmap.org/search?format=json&q=' || 
                   encode(full_address, 'escape') ||
                   '&limit=1&addressdetails=1';
    
    -- Vérifier si l'extension http est disponible
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
        RAISE EXCEPTION 'Extension http non disponible. Installez-la avec: CREATE EXTENSION IF NOT EXISTS http;';
    END IF;
    
    -- Appeler l'API Nominatim
    BEGIN
        -- Utiliser la fonction http_get si disponible (extension http v1.x)
        -- Sinon utiliser http() avec la syntaxe appropriée
        BEGIN
            SELECT content::JSONB INTO response
            FROM http_get(geocode_url);
        EXCEPTION
            WHEN undefined_function THEN
                -- Essayer avec la syntaxe http() (extension http v2.x)
                SELECT content::JSONB INTO response
                FROM http((
                    'GET',
                    geocode_url,
                    ARRAY[
                        http_header('User-Agent', 'SambaOne-Geocoding/1.0'),
                        http_header('Accept', 'application/json')
                    ],
                    'application/json',
                    ''
                )::http_request);
        END;
        
        -- Attendre pour respecter la limite de taux
        PERFORM pg_sleep(EXTRACT(EPOCH FROM rate_limit_delay));
        
        -- Extraire les coordonnées
        IF response IS NOT NULL AND jsonb_array_length(response) > 0 THEN
            SELECT 
                (response->0->>'lat')::DECIMAL,
                (response->0->>'lon')::DECIMAL
            INTO latitude, longitude;
            
            RETURN QUERY SELECT latitude, longitude;
        ELSE
            RAISE WARNING 'Aucun résultat trouvé pour l''adresse: %', full_address;
            RETURN;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Erreur lors du géocodage de l''adresse %: %', full_address, SQLERRM;
            RETURN;
    END;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les coordonnées d'une propriété spécifique
CREATE OR REPLACE FUNCTION update_property_coordinates(property_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    prop_record RECORD;
    coords RECORD;
BEGIN
    -- Récupérer les informations de la propriété
    SELECT id, address, city, latitude, longitude
    INTO prop_record
    FROM properties
    WHERE id = property_uuid;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Propriété non trouvée: %', property_uuid;
        RETURN FALSE;
    END IF;
    
    -- Vérifier si les coordonnées existent déjà
    IF prop_record.latitude IS NOT NULL AND prop_record.longitude IS NOT NULL THEN
        RAISE NOTICE 'Propriété % a déjà des coordonnées. Ignorée.', property_uuid;
        RETURN TRUE;
    END IF;
    
    -- Géocoder l'adresse
    SELECT * INTO coords
    FROM geocode_address(prop_record.address, prop_record.city);
    
    IF coords.latitude IS NOT NULL AND coords.longitude IS NOT NULL THEN
        -- Mettre à jour les coordonnées
        UPDATE properties
        SET 
            latitude = coords.latitude::TEXT,
            longitude = coords.longitude::TEXT
        WHERE id = property_uuid;
        
        RAISE NOTICE '✓ Coordonnées mises à jour pour la propriété %: (%, %)', 
            property_uuid, coords.latitude, coords.longitude;
        RETURN TRUE;
    ELSE
        RAISE WARNING '✗ Impossible de géocoder l''adresse pour la propriété %: %', 
            property_uuid, prop_record.address;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour toutes les propriétés sans coordonnées
CREATE OR REPLACE FUNCTION geocode_all_properties()
RETURNS TABLE(
    property_id UUID,
    property_name TEXT,
    address TEXT,
    success BOOLEAN,
    latitude DECIMAL,
    longitude DECIMAL,
    error_message TEXT
) AS $$
DECLARE
    prop_record RECORD;
    coords RECORD;
    success_flag BOOLEAN;
    error_msg TEXT;
    total_count INTEGER;
    processed_count INTEGER := 0;
    success_count INTEGER := 0;
BEGIN
    -- Compter le total de propriétés sans coordonnées
    SELECT COUNT(*) INTO total_count
    FROM properties
    WHERE latitude IS NULL OR longitude IS NULL;
    
    RAISE NOTICE 'Début du géocodage de % propriétés...', total_count;
    
    -- Parcourir toutes les propriétés sans coordonnées
    FOR prop_record IN 
        SELECT id, name, address, city
        FROM properties
        WHERE latitude IS NULL OR longitude IS NULL
        ORDER BY created_at
    LOOP
        processed_count := processed_count + 1;
        success_flag := FALSE;
        error_msg := NULL;
        
        BEGIN
            -- Géocoder l'adresse
            SELECT * INTO coords
            FROM geocode_address(prop_record.address, prop_record.city);
            
            IF coords.latitude IS NOT NULL AND coords.longitude IS NOT NULL THEN
                -- Mettre à jour les coordonnées
                UPDATE properties
                SET 
                    latitude = coords.latitude::TEXT,
                    longitude = coords.longitude::TEXT
                WHERE id = prop_record.id;
                
                success_flag := TRUE;
                success_count := success_count + 1;
                
                RAISE NOTICE '[%/%] ✓ % - (%, %)', 
                    processed_count, total_count, prop_record.name, 
                    coords.latitude, coords.longitude;
            ELSE
                error_msg := 'Aucun résultat de géocodage';
                RAISE WARNING '[%/%] ✗ % - %', 
                    processed_count, total_count, prop_record.name, error_msg;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                error_msg := SQLERRM;
                RAISE WARNING '[%/%] ✗ % - Erreur: %', 
                    processed_count, total_count, prop_record.name, error_msg;
        END;
        
        -- Retourner le résultat
        RETURN QUERY SELECT 
            prop_record.id,
            prop_record.name,
            prop_record.address,
            success_flag,
            coords.latitude,
            coords.longitude,
            error_msg;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Géocodage terminé:';
    RAISE NOTICE '  Total traité: %', processed_count;
    RAISE NOTICE '  Succès: %', success_count;
    RAISE NOTICE '  Échecs: %', (processed_count - success_count);
    RAISE NOTICE '========================================';
END;
$$ LANGUAGE plpgsql;

-- Script principal pour géocoder toutes les propriétés
-- Décommentez la ligne suivante pour exécuter automatiquement
-- SELECT * FROM geocode_all_properties();

-- Alternative: Mise à jour manuelle d'une propriété spécifique
-- SELECT update_property_coordinates('VOTRE_UUID_ICI');

-- Vérification des propriétés sans coordonnées
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
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY name;

-- Statistiques
SELECT 
    COUNT(*) AS total_properties,
    COUNT(latitude) AS with_latitude,
    COUNT(longitude) AS with_longitude,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS with_both_coords,
    COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) AS missing_coords
FROM properties;

-- =================================================================
-- INSTRUCTIONS D'UTILISATION
-- =================================================================
--
-- ⚠️  POUR SUPABASE (Recommandé):
--     Le script SQL avec extension http ne fonctionne PAS sur Supabase.
--     Utilisez plutôt le script TypeScript:
--
--     npm run update-geocoordinates -- --all
--     npm run update-geocoordinates -- --property-id=<UUID>
--
-- ✅ POUR POSTGRESQL AUTONOME:
--     1. Installez l'extension http:
--        CREATE EXTENSION IF NOT EXISTS http;
--
--     2. Exécutez ce script pour créer les fonctions:
--        \i init-db/32-geocode-properties-from-address.sql
--
--     3. Géocoder toutes les propriétés:
--        SELECT * FROM geocode_all_properties();
--
--     4. Ou géocoder une propriété spécifique:
--        SELECT update_property_coordinates('UUID');
--
-- =================================================================

