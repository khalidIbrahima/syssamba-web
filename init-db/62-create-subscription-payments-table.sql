-- =================================================================
-- SAMBA ONE - Table Subscription Payments
-- Script de création de la table des paiements d'abonnement
-- =================================================================

-- Création de la table subscription_payments
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'wave', 'orange_money')),
    
    -- Billing period this payment covers
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Payment status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed')),
    
    -- Payment provider data
    transaction_id TEXT, -- External transaction ID from payment provider
    provider_customer_id TEXT, -- Customer ID in payment provider system
    provider_subscription_id TEXT, -- Subscription ID in payment provider system (for recurring)
    
    -- Gateway response (store full response for debugging/audit)
    gateway_response JSONB DEFAULT '{}',
    
    -- Payment metadata
    failure_reason TEXT, -- Reason if payment failed
    refund_reason TEXT, -- Reason if refunded
    refunded_at TIMESTAMP WITH TIME ZONE,
    refunded_amount DECIMAL(10, 2), -- Partial refunds support
    
    -- Timestamps
    paid_at TIMESTAMP WITH TIME ZONE, -- When payment was completed
    failed_at TIMESTAMP WITH TIME ZONE, -- When payment failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sub_pay_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_pay_org ON subscription_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_pay_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_pay_transaction ON subscription_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sub_pay_period ON subscription_payments(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_sub_pay_created ON subscription_payments(created_at);

-- Commentaires pour documentation
COMMENT ON TABLE subscription_payments IS 'Table des paiements d''abonnement - historique des transactions de paiement';
COMMENT ON COLUMN subscription_payments.subscription_id IS 'Abonnement associé';
COMMENT ON COLUMN subscription_payments.organization_id IS 'Organisation (dupliqué pour performance)';
COMMENT ON COLUMN subscription_payments.amount IS 'Montant du paiement en FCFA';
COMMENT ON COLUMN subscription_payments.payment_method IS 'Méthode de paiement utilisée';
COMMENT ON COLUMN subscription_payments.billing_period_start IS 'Début de la période de facturation couverte';
COMMENT ON COLUMN subscription_payments.billing_period_end IS 'Fin de la période de facturation couverte';
COMMENT ON COLUMN subscription_payments.status IS 'Statut du paiement: pending, processing, completed, failed, refunded, disputed';
COMMENT ON COLUMN subscription_payments.transaction_id IS 'ID de transaction du fournisseur de paiement';
COMMENT ON COLUMN subscription_payments.gateway_response IS 'Réponse complète du gateway (pour audit et debugging)';
COMMENT ON COLUMN subscription_payments.failure_reason IS 'Raison de l''échec si le paiement a échoué';
COMMENT ON COLUMN subscription_payments.refunded_amount IS 'Montant remboursé (support des remboursements partiels)';

