-- =====================================================
-- 16-create-user-invitations-table.sql
-- Création de la table pour les invitations d'utilisateurs
-- =====================================================

-- Table des invitations d'utilisateurs
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT, -- Nullable si envoyé par SMS uniquement
    phone TEXT, -- Nullable si envoyé par email uniquement
    first_name TEXT,
    last_name TEXT,
    role TEXT CHECK (role IN ('owner', 'admin', 'accountant', 'agent', 'viewer')) DEFAULT 'viewer',
    token TEXT UNIQUE NOT NULL, -- Token unique pour le lien d'invitation
    invitation_method TEXT CHECK (invitation_method IN ('email', 'sms', 'both')) DEFAULT 'email', -- Méthode d'envoi
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ, -- Date d'envoi effectif de l'invitation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_invitations_org ON user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON user_invitations(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- Commentaires
COMMENT ON TABLE user_invitations IS 'Invitations envoyées aux utilisateurs pour rejoindre une organisation';
COMMENT ON COLUMN user_invitations.token IS 'Token unique utilisé dans le lien d''invitation';
COMMENT ON COLUMN user_invitations.expires_at IS 'Date d''expiration de l''invitation (généralement 7 jours)';
COMMENT ON COLUMN user_invitations.invitation_method IS 'Méthode d''envoi: email, sms, ou both (les deux)';
COMMENT ON COLUMN user_invitations.email IS 'Email de l''invité (nullable si envoyé par SMS uniquement)';
COMMENT ON COLUMN user_invitations.phone IS 'Téléphone de l''invité (nullable si envoyé par email uniquement)';
COMMENT ON COLUMN user_invitations.sent_at IS 'Date d''envoi effectif de l''invitation (email ou SMS)';

