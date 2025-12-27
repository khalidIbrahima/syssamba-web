-- =====================================================
-- Super Admin Support
-- Permet d'identifier les super-admins qui peuvent gérer toutes les organisations
-- =====================================================

-- Option 1: Ajouter une colonne is_super_admin à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Commentaires
COMMENT ON COLUMN users.is_super_admin IS 'Flag indiquant si l''utilisateur est un super-admin';

-- Fonction helper pour vérifier si un utilisateur est super-admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Vérifier dans la colonne is_super_admin
    IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND is_super_admin = TRUE) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW super_admin_users AS
SELECT
    u.id,
    u.sb_user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.organization_id,
    u.is_super_admin,
    u.created_at AS super_admin_since
FROM users u
WHERE u.is_super_admin = TRUE;

COMMENT ON VIEW super_admin_users IS 'Vue listant tous les super-admins';

