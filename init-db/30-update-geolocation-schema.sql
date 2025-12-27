-- =================================================================
-- SAMBA ONE - Mise à jour du schéma de géolocalisation
-- - Ajoute latitude/longitude à la table properties
-- - Supprime latitude/longitude de la table units (les lots utilisent les coordonnées du bien parent)
-- =================================================================

-- 1. Ajouter les colonnes latitude et longitude à la table properties si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter latitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'properties'
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE properties ADD COLUMN latitude DECIMAL(10, 8);
        RAISE NOTICE '✓ Colonne latitude ajoutée à la table properties';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne latitude existe déjà dans properties';
    END IF;

    -- Ajouter longitude
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'properties'
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE properties ADD COLUMN longitude DECIMAL(11, 8);
        RAISE NOTICE '✓ Colonne longitude ajoutée à la table properties';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne longitude existe déjà dans properties';
    END IF;
END $$;

-- 2. Supprimer les colonnes latitude et longitude de la table units si elles existent
DO $$ 
BEGIN
    -- Supprimer latitude de units
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'units'
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE units DROP COLUMN latitude;
        RAISE NOTICE '✓ Colonne latitude supprimée de la table units';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne latitude n''existe pas dans units';
    END IF;

    -- Supprimer longitude de units
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'units'
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE units DROP COLUMN longitude;
        RAISE NOTICE '✓ Colonne longitude supprimée de la table units';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne longitude n''existe pas dans units';
    END IF;
END $$;

-- 3. Créer un index spatial pour améliorer les performances des requêtes géographiques
-- Utilise l'extension PostGIS si disponible, sinon un index B-tree standard
DO $$ 
BEGIN
    -- Vérifier si PostGIS est disponible
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Créer un index spatial avec PostGIS
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'properties' 
            AND indexname = 'idx_properties_location_postgis'
        ) THEN
            CREATE INDEX idx_properties_location_postgis 
            ON properties USING GIST (
                ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)
            )
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
            RAISE NOTICE '✓ Index spatial PostGIS créé pour properties';
        END IF;
    ELSE
        -- Créer un index B-tree standard
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'properties' 
            AND indexname = 'idx_properties_location'
        ) THEN
            CREATE INDEX idx_properties_location 
            ON properties (latitude, longitude) 
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
            RAISE NOTICE '✓ Index B-tree créé pour properties (PostGIS non disponible)';
        END IF;
    END IF;
END $$;

-- 4. Ajouter les colonnes à la publication Supabase Realtime si nécessaire
DO $$ 
BEGIN
    -- Vérifier si la publication existe
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Ajouter les colonnes à la publication (si elles ne sont pas déjà incluses)
        -- Note: ALTER PUBLICATION ne supporte pas ADD COLUMN directement,
        -- donc on s'assure que la table est dans la publication
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'properties'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE properties;
            RAISE NOTICE '✓ Table properties ajoutée à la publication supabase_realtime';
        END IF;
    END IF;
END $$;

-- 5. Ajouter des commentaires pour documentation
COMMENT ON COLUMN properties.latitude IS 'Latitude du bien immobilier (coordonnées WGS84, format: -90.0 à 90.0). Les lots utilisent les coordonnées de leur bien parent.';
COMMENT ON COLUMN properties.longitude IS 'Longitude du bien immobilier (coordonnées WGS84, format: -180.0 à 180.0). Les lots utilisent les coordonnées de leur bien parent.';

-- 6. Afficher un résumé
DO $$ 
DECLARE
    props_with_coords INTEGER;
    props_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO props_total FROM properties;
    SELECT COUNT(*) INTO props_with_coords 
    FROM properties 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Résumé de la migration:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de biens: %', props_total;
    RAISE NOTICE 'Biens avec coordonnées: %', props_with_coords;
    RAISE NOTICE 'Biens sans coordonnées: %', (props_total - props_with_coords);
    RAISE NOTICE '';
    RAISE NOTICE 'Pour mettre à jour les coordonnées, utilisez:';
    RAISE NOTICE '  npm run update-geocoordinates -- --all';
    RAISE NOTICE '========================================';
END $$;

