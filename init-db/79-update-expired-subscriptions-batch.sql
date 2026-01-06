-- =====================================================
-- Batch: Update expired subscriptions status
-- Met à jour le statut des souscriptions 5 jours après la fin de leur période
-- =====================================================

-- Fonction pour mettre à jour les souscriptions expirées
-- Cette fonction peut être appelée par un cron job ou un scheduler

CREATE OR REPLACE FUNCTION update_expired_subscriptions()
RETURNS TABLE (
    updated_count INTEGER,
    subscription_ids UUID[]
) AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_subscription_ids UUID[] := ARRAY[]::UUID[];
    v_subscription_id UUID;
    v_expiration_date DATE;
BEGIN
    -- Parcourir toutes les souscriptions actives, en essai, ou en retard
    -- qui ont dépassé leur période de validité depuis plus de 5 jours
    FOR v_subscription_id IN
        SELECT id
        FROM subscriptions
        WHERE status IN ('active', 'trialing', 'past_due')
        AND (
            -- Cas 1: Annulation programmée à la fin de la période
            (cancel_at_period_end = true AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
            OR
            -- Cas 2: Date de fin explicite (end_date) dépassée depuis plus de 5 jours
            (end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '5 days')
            OR
            -- Cas 3: Pas de date de fin explicite, mais current_period_end dépassée depuis plus de 5 jours
            -- et pas d'annulation programmée
            (end_date IS NULL 
             AND cancel_at_period_end = false 
             AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
        )
    LOOP
        -- Déterminer la date d'expiration effective
        SELECT 
            CASE 
                -- Si annulation programmée, utiliser current_period_end
                WHEN cancel_at_period_end = true THEN current_period_end
                -- Sinon, utiliser end_date si elle existe, sinon current_period_end
                WHEN end_date IS NOT NULL THEN end_date
                ELSE current_period_end
            END
        INTO v_expiration_date
        FROM subscriptions
        WHERE id = v_subscription_id;

        -- Vérifier que la date d'expiration est bien dépassée depuis plus de 5 jours
        IF v_expiration_date < CURRENT_DATE - INTERVAL '5 days' THEN
            -- Mettre à jour le statut
            UPDATE subscriptions
            SET 
                status = CASE 
                    -- Si déjà annulé ou annulation programmée, mettre 'canceled'
                    WHEN cancel_at_period_end = true OR canceled_at IS NOT NULL THEN 'canceled'
                    -- Sinon, mettre 'expired'
                    ELSE 'expired'
                END,
                end_date = COALESCE(end_date, v_expiration_date), -- S'assurer que end_date est définie
                updated_at = NOW()
            WHERE id = v_subscription_id;

            -- Compter et enregistrer l'ID
            v_updated_count := v_updated_count + 1;
            v_subscription_ids := array_append(v_subscription_ids, v_subscription_id);
        END IF;
    END LOOP;

    -- Retourner les résultats
    RETURN QUERY SELECT v_updated_count, v_subscription_ids;
END;
$$ LANGUAGE plpgsql;

-- Commentaire sur la fonction
COMMENT ON FUNCTION update_expired_subscriptions() IS 
'Met à jour le statut des souscriptions expirées depuis plus de 5 jours. 
Considère cancel_at_period_end, end_date, et current_period_end.
Retourne le nombre de souscriptions mises à jour et leurs IDs.';

-- =====================================================
-- Script de mise à jour directe (pour exécution manuelle ou cron)
-- =====================================================

-- Option 1: Utiliser la fonction (recommandé)
-- SELECT * FROM update_expired_subscriptions();

-- Option 2: Mise à jour directe (alternative)
/*
UPDATE subscriptions
SET 
    status = CASE 
        WHEN cancel_at_period_end = true OR canceled_at IS NOT NULL THEN 'canceled'
        ELSE 'expired'
    END,
    end_date = COALESCE(
        end_date,
        CASE 
            WHEN cancel_at_period_end = true THEN current_period_end
            ELSE current_period_end
        END
    ),
    updated_at = NOW()
WHERE status IN ('active', 'trialing', 'past_due')
AND (
    -- Annulation programmée: utiliser current_period_end
    (cancel_at_period_end = true AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
    OR
    -- Date de fin explicite dépassée
    (end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '5 days')
    OR
    -- Pas de date de fin mais current_period_end dépassée
    (end_date IS NULL 
     AND cancel_at_period_end = false 
     AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
);
*/

-- =====================================================
-- Vue pour surveiller les souscriptions proches de l'expiration
-- =====================================================

CREATE OR REPLACE VIEW subscriptions_expiring_soon AS
SELECT 
    s.id,
    s.organization_id,
    o.name AS organization_name,
    p.name AS plan_name,
    s.status,
    s.current_period_end,
    s.end_date,
    s.cancel_at_period_end,
    s.canceled_at,
    CASE 
        WHEN s.cancel_at_period_end = true THEN s.current_period_end
        WHEN s.end_date IS NOT NULL THEN s.end_date
        ELSE s.current_period_end
    END AS effective_expiration_date,
    CASE 
        WHEN s.cancel_at_period_end = true THEN s.current_period_end
        WHEN s.end_date IS NOT NULL THEN s.end_date
        ELSE s.current_period_end
    END - CURRENT_DATE AS days_until_expiration
FROM subscriptions s
JOIN organizations o ON s.organization_id = o.id
JOIN plans p ON s.plan_id = p.id
WHERE s.status IN ('active', 'trialing', 'past_due')
AND (
    (s.cancel_at_period_end = true AND s.current_period_end < CURRENT_DATE + INTERVAL '10 days')
    OR
    (s.end_date IS NOT NULL AND s.end_date < CURRENT_DATE + INTERVAL '10 days')
    OR
    (s.end_date IS NULL AND s.cancel_at_period_end = false AND s.current_period_end < CURRENT_DATE + INTERVAL '10 days')
)
ORDER BY 
    CASE 
        WHEN s.cancel_at_period_end = true THEN s.current_period_end
        WHEN s.end_date IS NOT NULL THEN s.end_date
        ELSE s.current_period_end
    END ASC;

COMMENT ON VIEW subscriptions_expiring_soon IS 
'Vue des souscriptions qui vont expirer dans les 10 prochains jours.
Utile pour envoyer des notifications avant expiration.';

