-- =====================================================
-- 12-seed-payments.sql
-- Script pour générer des paiements basés sur les données réelles
-- Organisation ID: 098bc34f-130a-47d6-913c-fe5a93b02333
-- =====================================================

-- Vérifier que l'organisation existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM organizations WHERE id = '098bc34f-130a-47d6-913c-fe5a93b02333'
    ) THEN
        RAISE EXCEPTION 'Organization with ID 098bc34f-130a-47d6-913c-fe5a93b02333 does not exist';
    END IF;
END $$;

-- Créer les méthodes de paiement si elles n'existent pas
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    wave_method_id UUID;
    orange_method_id UUID;
    bank_method_id UUID;
    cash_method_id UUID;
BEGIN
    -- Wave Mobile Money
    INSERT INTO payment_methods (
        organization_id,
        name,
        slug,
        provider,
        is_active,
        is_default,
        visible_to_tenants,
        fee_type,
        fee_value
    ) VALUES (
        org_id,
        'Wave Mobile Money',
        'wave',
        'wave',
        true,
        true,
        true,
        'percent',
        0.015 -- 1.5% de frais
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO wave_method_id;

    -- Orange Money
    INSERT INTO payment_methods (
        organization_id,
        name,
        slug,
        provider,
        is_active,
        is_default,
        visible_to_tenants,
        fee_type,
        fee_value
    ) VALUES (
        org_id,
        'Orange Money',
        'orange-money',
        'orange',
        true,
        false,
        true,
        'percent',
        0.02 -- 2% de frais
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO orange_method_id;

    -- Virement Bancaire
    INSERT INTO payment_methods (
        organization_id,
        name,
        slug,
        provider,
        is_active,
        is_default,
        visible_to_tenants,
        fee_type,
        fee_value
    ) VALUES (
        org_id,
        'Virement Bancaire',
        'bank-transfer',
        'bank',
        true,
        false,
        true,
        'fixed',
        500 -- 500 FCFA de frais fixes
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO bank_method_id;

    -- Espèces
    INSERT INTO payment_methods (
        organization_id,
        name,
        slug,
        provider,
        is_active,
        is_default,
        visible_to_tenants,
        fee_type,
        fee_value
    ) VALUES (
        org_id,
        'Espèces',
        'cash',
        'cash',
        true,
        false,
        false,
        'none',
        0
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO cash_method_id;

    RAISE NOTICE '✓ Méthodes de paiement créées/vérifiées';
END $$;

-- Générer les paiements pour les locataires actifs
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    lease_rec RECORD;
    payment_id UUID;
    payment_date DATE;
    payment_method_id UUID;
    payment_amount DECIMAL;
    fee_amount DECIMAL;
    payment_status TEXT;
    paid_at TIMESTAMP;
    transaction_id TEXT;
    month_offset INT;
    payment_methods UUID[];
    method_index INT;
    method_fee_type TEXT;
    method_fee_value DECIMAL;
    months_to_generate INT := 6; -- Générer 6 mois de paiements
BEGIN
    -- Récupérer les IDs des méthodes de paiement
    SELECT ARRAY_AGG(id) INTO payment_methods
    FROM payment_methods
    WHERE organization_id = org_id AND is_active = true;

    -- Parcourir tous les baux actifs
    FOR lease_rec IN
        SELECT 
            l.id as lease_id,
            l.tenant_id,
            l.unit_id,
            l.start_date,
            l.end_date,
            l.rent_amount,
            u.charges_amount,
            u.rent_amount as unit_rent,
            t.first_name,
            t.last_name
        FROM leases l
        INNER JOIN tenants t ON t.id = l.tenant_id
        INNER JOIN units u ON u.id = l.unit_id
        WHERE l.organization_id = org_id
        AND l.signed = true
        AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
        ORDER BY l.start_date
    LOOP
        -- Calculer le montant total (loyer + charges)
        payment_amount := COALESCE(lease_rec.rent_amount::numeric, lease_rec.unit_rent::numeric, 0) + 
                         COALESCE(lease_rec.charges_amount::numeric, 0);

        -- Générer des paiements pour les 6 derniers mois
        FOR month_offset IN 0..(months_to_generate - 1) LOOP
            -- Date du paiement (dernier jour du mois)
            payment_date := DATE_TRUNC('month', CURRENT_DATE - (month_offset || ' months')::INTERVAL) + 
                           INTERVAL '1 month' - INTERVAL '1 day';
            
            -- Vérifier que le paiement est dans la période du bail
            IF payment_date < lease_rec.start_date THEN
                CONTINUE;
            END IF;
            IF lease_rec.end_date IS NOT NULL AND payment_date > lease_rec.end_date THEN
                CONTINUE;
            END IF;

            -- Sélectionner aléatoirement une méthode de paiement
            method_index := 1 + (RANDOM() * (array_length(payment_methods, 1) - 1))::INT;
            payment_method_id := payment_methods[method_index];

            -- Récupérer les frais de la méthode
            SELECT fee_type, fee_value INTO method_fee_type, method_fee_value
            FROM payment_methods
            WHERE id = payment_method_id;

            -- Calculer les frais
            IF method_fee_type = 'percent' THEN
                fee_amount := payment_amount * (method_fee_value / 100);
            ELSIF method_fee_type = 'fixed' THEN
                fee_amount := method_fee_value;
            ELSE
                fee_amount := 0;
            END IF;

            -- Déterminer le statut du paiement (80% complétés, 15% en attente, 5% échoués)
            IF RANDOM() < 0.80 THEN
                payment_status := 'completed';
                paid_at := payment_date + (RANDOM() * 3)::INT * INTERVAL '1 day'; -- Paié entre 0 et 3 jours après la date
                transaction_id := 'TXN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12));
            ELSIF RANDOM() < 0.95 THEN
                payment_status := 'pending';
                paid_at := NULL;
                transaction_id := NULL;
            ELSE
                payment_status := 'failed';
                paid_at := NULL;
                transaction_id := 'FAILED-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12));
            END IF;

            -- Générer l'ID du paiement
            payment_id := gen_random_uuid();

            -- Insérer le paiement
            INSERT INTO payments (
                id,
                organization_id,
                tenant_id,
                unit_id,
                payment_method_id,
                amount,
                fee_amount,
                status,
                transaction_id,
                paid_at,
                created_at
            ) VALUES (
                payment_id,
                org_id,
                lease_rec.tenant_id,
                lease_rec.unit_id,
                payment_method_id,
                payment_amount,
                fee_amount,
                payment_status,
                transaction_id,
                paid_at,
                payment_date - (RANDOM() * 5)::INT * INTERVAL '1 day' -- Créé quelques jours avant la date de paiement
            )
            ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Paiements générés avec succès';
END $$;

-- Générer des paiements supplémentaires pour les mois récents (2024-2025)
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    lease_rec RECORD;
    payment_id UUID;
    payment_date DATE;
    payment_method_id UUID;
    payment_amount DECIMAL;
    fee_amount DECIMAL;
    payment_status TEXT;
    paid_at TIMESTAMP;
    transaction_id TEXT;
    month_date DATE;
    payment_methods UUID[];
    method_index INT;
    method_fee_type TEXT;
    method_fee_value DECIMAL;
    year_num INT;
    month_num INT;
BEGIN
    -- Récupérer les IDs des méthodes de paiement
    SELECT ARRAY_AGG(id) INTO payment_methods
    FROM payment_methods
    WHERE organization_id = org_id AND is_active = true;

    -- Générer des paiements pour chaque mois de 2024 et 2025
    FOR year_num IN 2024..2025 LOOP
        FOR month_num IN 1..12 LOOP
            -- Ignorer les mois futurs
            IF year_num = 2025 AND month_num > EXTRACT(MONTH FROM CURRENT_DATE) THEN
                EXIT;
            END IF;

            month_date := DATE(year_num || '-' || LPAD(month_num::TEXT, 2, '0') || '-01');

            -- Parcourir tous les baux actifs à cette date
            FOR lease_rec IN
                SELECT 
                    l.id as lease_id,
                    l.tenant_id,
                    l.unit_id,
                    l.start_date,
                    l.end_date,
                    l.rent_amount,
                    u.charges_amount,
                    u.rent_amount as unit_rent
                FROM leases l
                INNER JOIN units u ON u.id = l.unit_id
                WHERE l.organization_id = org_id
                AND l.signed = true
                AND l.start_date <= month_date
                AND (l.end_date IS NULL OR l.end_date >= month_date)
            LOOP
                -- Vérifier si un paiement existe déjà pour ce mois
                IF EXISTS (
                    SELECT 1 FROM payments
                    WHERE tenant_id = lease_rec.tenant_id
                    AND unit_id = lease_rec.unit_id
                    AND DATE_TRUNC('month', created_at) = month_date
                ) THEN
                    CONTINUE;
                END IF;

                -- Calculer le montant total
                payment_amount := COALESCE(lease_rec.rent_amount::numeric, lease_rec.unit_rent::numeric, 0) + 
                                 COALESCE(lease_rec.charges_amount::numeric, 0);

                -- Date du paiement (entre le 1er et le 15 du mois)
                payment_date := month_date + (RANDOM() * 14)::INT * INTERVAL '1 day';

                -- Sélectionner aléatoirement une méthode de paiement
                method_index := 1 + (RANDOM() * (array_length(payment_methods, 1) - 1))::INT;
                payment_method_id := payment_methods[method_index];

                -- Récupérer les frais de la méthode
                SELECT fee_type, fee_value INTO method_fee_type, method_fee_value
                FROM payment_methods
                WHERE id = payment_method_id;

                -- Calculer les frais
                IF method_fee_type = 'percent' THEN
                    fee_amount := payment_amount * (method_fee_value / 100);
                ELSIF method_fee_type = 'fixed' THEN
                    fee_amount := method_fee_value;
                ELSE
                    fee_amount := 0;
                END IF;

                -- Déterminer le statut (plus de paiements complétés pour les mois passés)
                IF month_date < DATE_TRUNC('month', CURRENT_DATE) THEN
                    IF RANDOM() < 0.85 THEN
                        payment_status := 'completed';
                        paid_at := payment_date + (RANDOM() * 5)::INT * INTERVAL '1 day';
                        transaction_id := 'TXN-' || year_num || LPAD(month_num::TEXT, 2, '0') || '-' || 
                                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
                    ELSIF RANDOM() < 0.95 THEN
                        payment_status := 'pending';
                        paid_at := NULL;
                        transaction_id := NULL;
                    ELSE
                        payment_status := 'failed';
                        paid_at := NULL;
                        transaction_id := 'FAILED-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
                    END IF;
                ELSE
                    -- Mois en cours ou futur : plus de paiements en attente
                    IF RANDOM() < 0.60 THEN
                        payment_status := 'completed';
                        paid_at := payment_date + (RANDOM() * 3)::INT * INTERVAL '1 day';
                        transaction_id := 'TXN-' || year_num || LPAD(month_num::TEXT, 2, '0') || '-' || 
                                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
                    ELSE
                        payment_status := 'pending';
                        paid_at := NULL;
                        transaction_id := NULL;
                    END IF;
                END IF;

                -- Générer l'ID du paiement
                payment_id := gen_random_uuid();

                -- Insérer le paiement
                INSERT INTO payments (
                    id,
                    organization_id,
                    tenant_id,
                    unit_id,
                    payment_method_id,
                    amount,
                    fee_amount,
                    status,
                    transaction_id,
                    paid_at,
                    created_at
                ) VALUES (
                    payment_id,
                    org_id,
                    lease_rec.tenant_id,
                    lease_rec.unit_id,
                    payment_method_id,
                    payment_amount,
                    fee_amount,
                    payment_status,
                    transaction_id,
                    paid_at,
                    payment_date
                )
                ON CONFLICT (id) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Paiements historiques générés (2024-2025)';
END $$;

-- Vérification: Afficher les statistiques des paiements
SELECT 
    'Statistiques des paiements' as info,
    COUNT(*) as total_payments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
    ROUND(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END)) as total_completed_amount_fcfa,
    ROUND(SUM(CASE WHEN status = 'pending' THEN amount::numeric ELSE 0 END)) as total_pending_amount_fcfa,
    ROUND(SUM(fee_amount::numeric)) as total_fees_fcfa,
    COUNT(DISTINCT tenant_id) as unique_tenants,
    COUNT(DISTINCT unit_id) as unique_units,
    MIN(created_at) as first_payment_date,
    MAX(created_at) as last_payment_date
FROM payments
WHERE organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';

-- Statistiques par méthode de paiement
SELECT 
    pm.name as payment_method,
    COUNT(p.id) as payment_count,
    ROUND(SUM(CASE WHEN p.status = 'completed' THEN p.amount::numeric ELSE 0 END)) as total_amount_fcfa,
    ROUND(SUM(p.fee_amount::numeric)) as total_fees_fcfa
FROM payments p
INNER JOIN payment_methods pm ON pm.id = p.payment_method_id
WHERE p.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
GROUP BY pm.name
ORDER BY payment_count DESC;

-- Statistiques par mois
SELECT 
    TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
    COUNT(*) as payment_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    ROUND(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END)) as total_amount_fcfa
FROM payments
WHERE organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

