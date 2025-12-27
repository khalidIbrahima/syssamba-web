-- =====================================================
-- 17-add-invitation-method-column.sql
-- Ajouter la colonne invitation_method si elle n'existe pas
-- =====================================================

-- Vérifier et ajouter la colonne invitation_method si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_invitations' 
        AND column_name = 'invitation_method'
    ) THEN
        ALTER TABLE user_invitations 
        ADD COLUMN invitation_method TEXT CHECK (invitation_method IN ('email', 'sms', 'both')) DEFAULT 'email';
        
        RAISE NOTICE '✓ Colonne invitation_method ajoutée à user_invitations';
    ELSE
        RAISE NOTICE '✓ Colonne invitation_method existe déjà';
    END IF;
END $$;

-- Vérifier et rendre email nullable si nécessaire
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_invitations' 
        AND column_name = 'email'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE user_invitations 
        ALTER COLUMN email DROP NOT NULL;
        
        RAISE NOTICE '✓ Colonne email rendue nullable';
    ELSE
        RAISE NOTICE '✓ Colonne email est déjà nullable';
    END IF;
END $$;

-- Vérifier et ajouter la colonne sent_at si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_invitations' 
        AND column_name = 'sent_at'
    ) THEN
        ALTER TABLE user_invitations 
        ADD COLUMN sent_at TIMESTAMPTZ;
        
        RAISE NOTICE '✓ Colonne sent_at ajoutée à user_invitations';
    ELSE
        RAISE NOTICE '✓ Colonne sent_at existe déjà';
    END IF;
END $$;

-- Ajouter l'index sur phone si la colonne existe et l'index n'existe pas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_invitations' 
        AND column_name = 'phone'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'user_invitations' 
        AND indexname = 'idx_invitations_phone'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_invitations_phone ON user_invitations(phone);
        
        RAISE NOTICE '✓ Index idx_invitations_phone créé';
    ELSE
        RAISE NOTICE '✓ Index idx_invitations_phone existe déjà ou colonne phone n''existe pas';
    END IF;
END $$;

-- Commentaires
COMMENT ON COLUMN user_invitations.invitation_method IS 'Méthode d''envoi: email, sms, ou both (les deux)';
COMMENT ON COLUMN user_invitations.email IS 'Email de l''invité (nullable si envoyé par SMS uniquement)';
COMMENT ON COLUMN user_invitations.phone IS 'Téléphone de l''invité (nullable si envoyé par email uniquement)';
COMMENT ON COLUMN user_invitations.sent_at IS 'Date d''envoi effectif de l''invitation (email ou SMS)';

