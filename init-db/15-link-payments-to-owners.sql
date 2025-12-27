-- =====================================================
-- 15-link-payments-to-owners.sql
-- Script pour lier les paiements aux propriétaires et générer les virements
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

-- S'assurer que les tables existent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'owners') THEN
        RAISE EXCEPTION 'Table owners does not exist. Please run 13-create-owner-transfers-table.sql first';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'owner_transfers') THEN
        RAISE EXCEPTION 'Table owner_transfers does not exist. Please run 13-create-owner-transfers-table.sql first';
    END IF;
END $$;

-- Lier les paiements aux propriétaires et créer les virements
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    payment_rec RECORD;
    owner_rec RECORD;
    transfer_id UUID;
    transfer_amount DECIMAL;
    commission_amount DECIMAL;
    commission_rate DECIMAL;
    due_date DATE;
    transfer_status TEXT;
    transferred_at TIMESTAMPTZ;
    transfer_methods TEXT[] := ARRAY['bank_transfer', 'wave', 'orange_money', 'cash'];
    transfer_method TEXT;
    transfer_reference TEXT;
    days_since_payment INT;
    transfer_count INT := 0;
BEGIN
    RAISE NOTICE 'Début de la liaison des paiements aux propriétaires...';

    -- Parcourir tous les paiements complétés qui n'ont pas encore de virement
    FOR payment_rec IN
        SELECT 
            p.id as payment_id,
            p.tenant_id,
            p.unit_id,
            p.amount,
            p.paid_at,
            p.created_at,
            p.status as payment_status,
            u.property_id,
            u.rent_amount,
            u.charges_amount
        FROM payments p
        INNER JOIN units u ON u.id = p.unit_id
        WHERE p.organization_id = org_id
        AND p.status = 'completed'
        AND p.paid_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM owner_transfers ot
            WHERE ot.payment_id = p.id
        )
        ORDER BY p.paid_at DESC
    LOOP
        -- Trouver le propriétaire de la propriété
        SELECT o.id, o.commission_rate
        INTO owner_rec
        FROM owners o
        WHERE o.organization_id = org_id
        AND o.property_id = payment_rec.property_id
        AND o.is_active = true
        LIMIT 1;

        -- Si aucun propriétaire trouvé, passer au suivant
        IF owner_rec.id IS NULL THEN
            RAISE NOTICE 'Aucun propriétaire trouvé pour la propriété % (paiement %)', 
                payment_rec.property_id, payment_rec.payment_id;
            CONTINUE;
        END IF;

        -- Calculer la commission et le montant à virer
        commission_rate := owner_rec.commission_rate / 100.0;
        commission_amount := payment_rec.amount::numeric * commission_rate;
        transfer_amount := payment_rec.amount::numeric - commission_amount;

        -- Date prévue du virement (5 jours après le paiement)
        due_date := payment_rec.paid_at::DATE + INTERVAL '5 days';

        -- Calculer le nombre de jours depuis le paiement
        days_since_payment := (CURRENT_DATE - payment_rec.paid_at::DATE)::INT;

        -- Déterminer le statut du virement
        IF days_since_payment > 5 THEN
            -- Paiement ancien : virement effectué
            transfer_status := 'completed';
            transferred_at := due_date + (RANDOM() * 2)::INT * INTERVAL '1 day';
            transfer_method := transfer_methods[1 + (RANDOM() * (array_length(transfer_methods, 1) - 1))::INT];
            transfer_reference := 'VIR-' || TO_CHAR(transferred_at, 'YYYYMMDD') || '-' || 
                                 UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        ELSIF days_since_payment > 2 THEN
            -- Paiement récent : en attente
            transfer_status := 'pending';
            transferred_at := NULL;
            transfer_method := NULL;
            transfer_reference := NULL;
        ELSE
            -- Paiement très récent : programmé
            transfer_status := 'scheduled';
            transferred_at := NULL;
            transfer_method := NULL;
            transfer_reference := NULL;
        END IF;

        -- Générer l'ID du virement
        transfer_id := gen_random_uuid();

        -- Insérer le virement
        INSERT INTO owner_transfers (
            id,
            organization_id,
            owner_id,
            unit_id,
            property_id,
            payment_id,
            amount,
            commission_amount,
            due_date,
            status,
            transfer_method,
            transfer_reference,
            transferred_at,
            created_at
        ) VALUES (
            transfer_id,
            org_id,
            owner_rec.id,
            payment_rec.unit_id,
            payment_rec.property_id,
            payment_rec.payment_id,
            transfer_amount,
            commission_amount,
            due_date,
            transfer_status,
            transfer_method,
            transfer_reference,
            transferred_at,
            payment_rec.paid_at
        );

        transfer_count := transfer_count + 1;
    END LOOP;

    RAISE NOTICE '✓ % virements créés à partir des paiements existants', transfer_count;
END $$;

-- Créer des virements programmés pour les paiements en attente
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    lease_rec RECORD;
    owner_rec RECORD;
    transfer_id UUID;
    transfer_amount DECIMAL;
    commission_amount DECIMAL;
    commission_rate DECIMAL;
    due_date DATE;
    month_date DATE;
    year_num INT;
    month_num INT;
    scheduled_count INT := 0;
BEGIN
    RAISE NOTICE 'Génération des virements programmés pour les mois à venir...';

    -- Générer des virements programmés pour les 3 prochains mois
    FOR year_num IN EXTRACT(YEAR FROM CURRENT_DATE)..(EXTRACT(YEAR FROM CURRENT_DATE) + 1) LOOP
        FOR month_num IN 1..12 LOOP
            -- Ignorer les mois passés
            IF year_num = EXTRACT(YEAR FROM CURRENT_DATE) AND month_num < EXTRACT(MONTH FROM CURRENT_DATE) THEN
                CONTINUE;
            END IF;

            -- Ignorer les mois trop loin dans le futur
            IF year_num > EXTRACT(YEAR FROM CURRENT_DATE) + 1 OR 
               (year_num = EXTRACT(YEAR FROM CURRENT_DATE) + 1 AND month_num > 3) THEN
                EXIT;
            END IF;

            month_date := DATE(year_num || '-' || LPAD(month_num::TEXT, 2, '0') || '-01');
            due_date := month_date + INTERVAL '1 month' - INTERVAL '1 day'; -- Dernier jour du mois

            -- Parcourir tous les baux actifs
            FOR lease_rec IN
                SELECT 
                    l.id as lease_id,
                    l.unit_id,
                    l.rent_amount,
                    u.property_id,
                    u.rent_amount as unit_rent,
                    u.charges_amount
                FROM leases l
                INNER JOIN units u ON u.id = l.unit_id
                WHERE l.organization_id = org_id
                AND l.signed = true
                AND l.start_date <= due_date
                AND (l.end_date IS NULL OR l.end_date >= month_date)
            LOOP
                -- Vérifier si un virement existe déjà pour ce mois et cette unité
                IF EXISTS (
                    SELECT 1 FROM owner_transfers ot
                    WHERE ot.unit_id = lease_rec.unit_id
                    AND DATE_TRUNC('month', ot.due_date) = month_date
                ) THEN
                    CONTINUE;
                END IF;

                -- Trouver le propriétaire
                SELECT o.id, o.commission_rate
                INTO owner_rec
                FROM owners o
                WHERE o.organization_id = org_id
                AND o.property_id = lease_rec.property_id
                AND o.is_active = true
                LIMIT 1;

                IF owner_rec.id IS NULL THEN
                    CONTINUE;
                END IF;

                -- Calculer le montant (loyer + charges)
                transfer_amount := COALESCE(lease_rec.rent_amount::numeric, lease_rec.unit_rent::numeric, 0) + 
                                 COALESCE(lease_rec.charges_amount::numeric, 0);

                -- Calculer la commission et le montant net
                commission_rate := owner_rec.commission_rate / 100.0;
                commission_amount := transfer_amount * commission_rate;
                transfer_amount := transfer_amount - commission_amount;

                -- Générer l'ID du virement
                transfer_id := gen_random_uuid();

                -- Insérer le virement programmé
                INSERT INTO owner_transfers (
                    id,
                    organization_id,
                    owner_id,
                    unit_id,
                    property_id,
                    amount,
                    commission_amount,
                    due_date,
                    status,
                    created_at
                ) VALUES (
                    transfer_id,
                    org_id,
                    owner_rec.id,
                    lease_rec.unit_id,
                    lease_rec.property_id,
                    transfer_amount,
                    commission_amount,
                    due_date,
                    'scheduled',
                    CURRENT_DATE
                );

                scheduled_count := scheduled_count + 1;
            END LOOP;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ % virements programmés créés', scheduled_count;
END $$;

-- Vérification: Statistiques des liens paiements-virements
SELECT 
    'Statistiques des liens paiements-virements' as info,
    COUNT(DISTINCT p.id) as total_payments,
    COUNT(DISTINCT ot.id) as total_transfers,
    COUNT(DISTINCT CASE WHEN ot.payment_id IS NOT NULL THEN ot.id END) as transfers_linked_to_payments,
    ROUND(SUM(CASE WHEN ot.payment_id IS NOT NULL THEN ot.amount::numeric ELSE 0 END)) as total_linked_amount_fcfa
FROM payments p
LEFT JOIN owner_transfers ot ON ot.payment_id = p.id
WHERE p.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
AND p.status = 'completed';

-- Vérification: Paiements sans virement
SELECT 
    'Paiements sans virement' as info,
    COUNT(*) as count,
    ROUND(SUM(amount::numeric)) as total_amount_fcfa
FROM payments p
WHERE p.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
AND p.status = 'completed'
AND p.paid_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM owner_transfers ot
    WHERE ot.payment_id = p.id
);

-- Vérification: Virements par propriétaire
SELECT 
    o.first_name || ' ' || o.last_name as owner_name,
    COUNT(ot.id) as transfer_count,
    COUNT(CASE WHEN ot.payment_id IS NOT NULL THEN 1 END) as transfers_from_payments,
    ROUND(SUM(CASE WHEN ot.status = 'completed' THEN ot.amount::numeric ELSE 0 END)) as total_completed_fcfa,
    ROUND(SUM(ot.commission_amount::numeric)) as total_commission_fcfa
FROM owners o
LEFT JOIN owner_transfers ot ON ot.owner_id = o.id
WHERE o.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
GROUP BY o.id, o.first_name, o.last_name
ORDER BY transfer_count DESC;

