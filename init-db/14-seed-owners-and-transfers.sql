-- =====================================================
-- 14-seed-owners-and-transfers.sql
-- Script pour créer des propriétaires et générer des virements
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

-- Créer les propriétaires pour chaque propriété
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    prop_rec RECORD;
    owner_id UUID;
    owner_names TEXT[][] := ARRAY[
        ARRAY['Amadou', 'Ba'],
        ARRAY['Fatou', 'Diop'],
        ARRAY['Moussa', 'Seck'],
        ARRAY['Aïssatou', 'Ndiaye'],
        ARRAY['Cheikh', 'Fall'],
        ARRAY['Mariama', 'Sarr'],
        ARRAY['Ousmane', 'Diallo'],
        ARRAY['Khadija', 'Cissé']
    ];
    name_index INT := 0;
    phone_prefixes TEXT[] := ARRAY['77', '76', '78'];
    bank_names TEXT[] := ARRAY['CBAO', 'SGBC', 'Ecobank', 'BHS', 'Banque Atlantique'];
BEGIN
    -- Parcourir toutes les propriétés
    FOR prop_rec IN
        SELECT id, name
        FROM properties
        WHERE organization_id = org_id
        ORDER BY created_at
    LOOP
        -- Créer un propriétaire pour chaque propriété
        owner_id := gen_random_uuid();
        name_index := (name_index % array_length(owner_names, 1)) + 1;
        
        -- Vérifier si un propriétaire existe déjà pour cette propriété
        IF NOT EXISTS (
            SELECT 1 FROM owners 
            WHERE organization_id = org_id 
            AND property_id = prop_rec.id
        ) THEN
            INSERT INTO owners (
                id,
                organization_id,
                property_id,
                first_name,
                last_name,
                email,
                phone,
                bank_account,
                bank_name,
                commission_rate,
                is_active,
                notes,
                created_at
            ) VALUES (
                owner_id,
                org_id,
                prop_rec.id,
                owner_names[name_index][1],
                owner_names[name_index][2],
                LOWER(owner_names[name_index][1]) || '.' || LOWER(owner_names[name_index][2]) || '@gmail.com',
            '+221 ' || phone_prefixes[1 + (RANDOM() * (array_length(phone_prefixes, 1) - 1))::INT] || ' ' || 
            LPAD((FLOOR(RANDOM() * 99999999))::INT::TEXT, 8, '0'),
            'SN' || LPAD((FLOOR(RANDOM() * 999999999999))::BIGINT::TEXT, 12, '0'),
                bank_names[1 + (RANDOM() * (array_length(bank_names, 1) - 1))::INT],
                15.00 + (RANDOM() * 10)::INT, -- Commission entre 15% et 25%
                true,
                'Propriétaire de ' || prop_rec.name,
                NOW() - (RANDOM() * 365)::INT * INTERVAL '1 day'
            );
        END IF;

        RAISE NOTICE '✓ Propriétaire créé pour %: % %', prop_rec.name, owner_names[name_index][1], owner_names[name_index][2];
    END LOOP;

    RAISE NOTICE '✓ Propriétaires créés avec succès';
END $$;

-- Générer les virements aux propriétaires basés sur les paiements complétés
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
BEGIN
    -- Parcourir tous les paiements complétés
    FOR payment_rec IN
        SELECT 
            p.id as payment_id,
            p.tenant_id,
            p.unit_id,
            p.amount,
            p.paid_at,
            p.created_at,
            u.property_id,
            u.rent_amount,
            u.charges_amount
        FROM payments p
        INNER JOIN units u ON u.id = p.unit_id
        WHERE p.organization_id = org_id
        AND p.status = 'completed'
        AND p.paid_at IS NOT NULL
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
            CONTINUE;
        END IF;

        -- Vérifier si un virement existe déjà pour ce paiement
        IF EXISTS (
            SELECT 1 FROM owner_transfers
            WHERE payment_id = payment_rec.payment_id
        ) THEN
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
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;

    RAISE NOTICE '✓ Virements aux propriétaires générés avec succès';
END $$;

-- Générer des virements pour les paiements futurs (programmés)
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
BEGIN
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
                )
                ON CONFLICT (id) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Virements programmés générés avec succès';
END $$;

-- Vérification: Afficher les statistiques
SELECT 
    'Statistiques des propriétaires' as info,
    COUNT(*) as total_owners,
    COUNT(CASE WHEN is_active THEN 1 END) as active_owners,
    ROUND(AVG(commission_rate), 2) as avg_commission_rate
FROM owners
WHERE organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';

SELECT 
    'Statistiques des virements' as info,
    COUNT(*) as total_transfers,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transfers,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transfers,
    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_transfers,
    ROUND(SUM(CASE WHEN status = 'completed' THEN amount::numeric ELSE 0 END)) as total_completed_amount_fcfa,
    ROUND(SUM(CASE WHEN status = 'pending' THEN amount::numeric ELSE 0 END)) as total_pending_amount_fcfa,
    ROUND(SUM(CASE WHEN status = 'scheduled' THEN amount::numeric ELSE 0 END)) as total_scheduled_amount_fcfa,
    ROUND(SUM(commission_amount::numeric)) as total_commission_fcfa,
    COUNT(DISTINCT owner_id) as unique_owners,
    MIN(due_date) as earliest_due_date,
    MAX(due_date) as latest_due_date
FROM owner_transfers
WHERE organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';

-- Statistiques par propriétaire
SELECT 
    o.first_name || ' ' || o.last_name as owner_name,
    p.name as property_name,
    COUNT(ot.id) as transfer_count,
    ROUND(SUM(CASE WHEN ot.status = 'completed' THEN ot.amount::numeric ELSE 0 END)) as total_received_fcfa,
    ROUND(SUM(ot.commission_amount::numeric)) as total_commission_fcfa
FROM owners o
LEFT JOIN owner_transfers ot ON ot.owner_id = o.id
LEFT JOIN properties p ON p.id = o.property_id
WHERE o.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
GROUP BY o.id, o.first_name, o.last_name, p.name
ORDER BY total_received_fcfa DESC;

