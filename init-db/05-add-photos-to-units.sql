-- =================================================================
-- SAMBA ONE - Support des photos multiples pour properties et units
-- Script de migration pour permettre l'ajout de plusieurs photos
-- =================================================================

-- Ajouter la colonne photo_urls (TEXT[]) à la table units si elle n'existe pas
-- Cette colonne permet de stocker plusieurs URLs de photos par unité
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'photo_urls'
    ) THEN
        ALTER TABLE units ADD COLUMN photo_urls TEXT[] DEFAULT '{}';
        COMMENT ON COLUMN units.photo_urls IS 'Tableau des URLs des photos de l''unité locative. Permet de stocker plusieurs photos par unité (ex: ["https://...", "https://..."])';
    END IF;
END $$;

-- Vérifier que la colonne photo_urls existe bien dans properties
-- Cette colonne permet de stocker plusieurs URLs de photos par bien
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'photo_urls'
    ) THEN
        ALTER TABLE properties ADD COLUMN photo_urls TEXT[] DEFAULT '{}';
        COMMENT ON COLUMN properties.photo_urls IS 'Tableau des URLs des photos du bien immobilier. Permet de stocker plusieurs photos par bien (ex: ["https://...", "https://..."])';
    END IF;
END $$;

-- Mettre à jour les commentaires pour documentation
COMMENT ON COLUMN units.photo_urls IS 'Tableau PostgreSQL (TEXT[]) des URLs des photos de l''unité locative. Permet de stocker plusieurs photos par unité. Format: ["url1", "url2", ...]';
COMMENT ON COLUMN properties.photo_urls IS 'Tableau PostgreSQL (TEXT[]) des URLs des photos du bien immobilier. Permet de stocker plusieurs photos par bien. Format: ["url1", "url2", ...]';

