-- =====================================================
-- 09-seed-tenants.sql
-- Script pour générer des données réelles de locataires
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

-- Créer les locataires pour les unités occupées (sauf celles qui auront des locataires spécifiques)
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    unit_rec RECORD;
    tenant_id UUID;
    lease_id UUID;
    start_date DATE;
    end_date DATE;
    first_names TEXT[] := ARRAY['Fatou', 'Aïssatou', 'Moussa', 'Cheikh', 'Amadou', 'Mariama', 'Ousmane', 'Khadija', 'Ibrahima', 'Aminata', 'Papa', 'Mamadou', 'Saliou', 'Awa', 'Binta'];
    last_names TEXT[] := ARRAY['Diop', 'Ndiaye', 'Seck', 'Fall', 'Ba', 'Sarr', 'Diallo', 'Cissé', 'Kane', 'Thiam', 'Sy', 'Sow', 'Gueye', 'Mbaye', 'Faye'];
    first_name TEXT;
    last_name TEXT;
    phone_prefix TEXT;
    phone_number TEXT;
    email TEXT;
    id_num TEXT;
    counter INT := 0;
BEGIN
    -- Parcourir toutes les unités occupées qui n'ont pas encore de locataire
    FOR unit_rec IN 
        SELECT u.id, u.unit_number, u.rent_amount, u.charges_amount, u.deposit_amount
        FROM units u
        LEFT JOIN tenants t ON t.unit_id = u.id
        WHERE u.organization_id = org_id
        AND u.status = 'occupied'
        AND t.id IS NULL
        ORDER BY u.created_at
    LOOP
        -- Générer un ID pour le locataire
        tenant_id := gen_random_uuid();
        
        -- Sélectionner aléatoirement un prénom et un nom
        first_name := first_names[1 + (RANDOM() * (array_length(first_names, 1) - 1))::INT];
        last_name := last_names[1 + (RANDOM() * (array_length(last_names, 1) - 1))::INT];
        
        -- Générer un numéro de téléphone sénégalais
        phone_prefix := CASE (RANDOM() * 3)::INT
            WHEN 0 THEN '77'
            WHEN 1 THEN '76'
            ELSE '78'
        END;
        phone_number := '+221 ' || phone_prefix || ' ' || LPAD((RANDOM() * 99999999)::INT::TEXT, 8, '0');
        
        -- Générer un email
        email := LOWER(first_name) || '.' || LOWER(last_name) || counter::TEXT || '@gmail.com';
        counter := counter + 1;
        
        -- Générer un numéro d'identification
        id_num := 'SN' || LPAD((RANDOM() * 999999999)::INT::TEXT, 9, '0');
        
        -- Insérer le locataire
        INSERT INTO tenants (
            id,
            organization_id,
            unit_id,
            first_name,
            last_name,
            phone,
            email,
            id_number,
            has_extranet_access,
            language,
            created_at
        ) VALUES (
            tenant_id,
            org_id,
            unit_rec.id,
            first_name,
            last_name,
            phone_number,
            email,
            id_num,
            (RANDOM() > 0.5), -- 50% ont accès à l'extranet
            'fr',
            NOW() - (RANDOM() * 365)::INT * INTERVAL '1 day' -- Date de création aléatoire dans la dernière année
        );

        -- Créer un bail pour ce locataire
        lease_id := gen_random_uuid();
        
        -- Date de début : il y a entre 1 et 24 mois
        start_date := CURRENT_DATE - (RANDOM() * 730 + 30)::INT * INTERVAL '1 day';
        
        -- Date de fin : entre 6 et 36 mois après la date de début
        end_date := start_date + (RANDOM() * 900 + 180)::INT * INTERVAL '1 day';

        INSERT INTO leases (
            id,
            organization_id,
            unit_id,
            tenant_id,
            start_date,
            end_date,
            rent_amount,
            deposit_paid,
            signed,
            created_at
        ) VALUES (
            lease_id,
            org_id,
            unit_rec.id,
            tenant_id,
            start_date,
            end_date,
            unit_rec.rent_amount,
            (RANDOM() > 0.2), -- 80% ont payé la caution
            (RANDOM() > 0.1), -- 90% ont signé le bail
            NOW() - (RANDOM() * 365)::INT * INTERVAL '1 day'
        );

        RAISE NOTICE 'Locataire créé pour l''unité %', unit_rec.unit_number;
    END LOOP;

    RAISE NOTICE '✓ Locataires générés créés avec succès';
END $$;

-- Créer quelques locataires spécifiques pour correspondre aux données de l'image
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    unit1_id UUID;
    unit2_id UUID;
    unit3_id UUID;
    unit4_id UUID;
    unit5_id UUID;
    tenant1_id UUID;
    tenant2_id UUID;
    tenant3_id UUID;
    tenant4_id UUID;
    tenant5_id UUID;
    lease1_id UUID;
    lease2_id UUID;
    lease3_id UUID;
    lease4_id UUID;
    lease5_id UUID;
BEGIN
    -- Récupérer les IDs des unités spécifiques
    SELECT id INTO unit1_id FROM units 
    WHERE organization_id = org_id 
    AND unit_number LIKE 'A101' 
    LIMIT 1;
    
    SELECT id INTO unit2_id FROM units 
    WHERE organization_id = org_id 
    AND unit_number LIKE 'A201' 
    LIMIT 1;
    
    SELECT id INTO unit3_id FROM units 
    WHERE organization_id = org_id 
    AND unit_number LIKE 'B101' 
    LIMIT 1;
    
    SELECT id INTO unit4_id FROM units 
    WHERE organization_id = org_id 
    AND unit_number LIKE 'M101' 
    LIMIT 1;
    
    SELECT id INTO unit5_id FROM units 
    WHERE organization_id = org_id 
    AND unit_number LIKE 'O101' 
    LIMIT 1;

    -- Locataire 1: Fatou Diop (pour unit1_id - A101)
    IF unit1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants WHERE unit_id = unit1_id) THEN
        tenant1_id := gen_random_uuid();
        INSERT INTO tenants (
            id, organization_id, unit_id, first_name, last_name, phone, email, id_number, has_extranet_access, language, created_at
        ) VALUES (
            tenant1_id, org_id, unit1_id, 'Fatou', 'Diop', '+221 77 123 45 67', 'fatou.diop@gmail.com', 'SN123456789', true, 'fr', '2023-01-15'::TIMESTAMP
        );
        
        lease1_id := gen_random_uuid();
        INSERT INTO leases (
            id, organization_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_paid, signed, created_at
        ) VALUES (
            lease1_id, org_id, unit1_id, tenant1_id, '2023-01-15'::DATE, '2024-01-15'::DATE, 450000, true, true, '2023-01-15'::TIMESTAMP
        );
        RAISE NOTICE 'Locataire Fatou Diop créé pour A101';
    END IF;

    -- Locataire 2: Moussa Seck (pour unit3_id - B101)
    IF unit3_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants WHERE unit_id = unit3_id) THEN
        tenant3_id := gen_random_uuid();
        INSERT INTO tenants (
            id, organization_id, unit_id, first_name, last_name, phone, email, id_number, has_extranet_access, language, created_at
        ) VALUES (
            tenant3_id, org_id, unit3_id, 'Moussa', 'Seck', '+221 76 234 56 78', 'moussa.seck@gmail.com', 'SN234567890', false, 'fr', '2023-03-01'::TIMESTAMP
        );
        
        lease3_id := gen_random_uuid();
        INSERT INTO leases (
            id, organization_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_paid, signed, created_at
        ) VALUES (
            lease3_id, org_id, unit3_id, tenant3_id, '2023-03-01'::DATE, '2024-03-01'::DATE, 400000, true, true, '2023-03-01'::TIMESTAMP
        );
        RAISE NOTICE 'Locataire Moussa Seck créé pour B101';
    END IF;

    -- Locataire 3: Aïssatou Fall (pour unit4_id - M101)
    IF unit4_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants WHERE unit_id = unit4_id) THEN
        tenant4_id := gen_random_uuid();
        INSERT INTO tenants (
            id, organization_id, unit_id, first_name, last_name, phone, email, id_number, has_extranet_access, language, created_at
        ) VALUES (
            tenant4_id, org_id, unit4_id, 'Aïssatou', 'Fall', '+221 78 345 67 89', 'aissatou.fall@gmail.com', 'SN345678901', true, 'fr', '2023-05-10'::TIMESTAMP
        );
        
        lease4_id := gen_random_uuid();
        INSERT INTO leases (
            id, organization_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_paid, signed, created_at
        ) VALUES (
            lease4_id, org_id, unit4_id, tenant4_id, '2023-05-10'::DATE, '2024-05-10'::DATE, 420000, true, true, '2023-05-10'::TIMESTAMP
        );
        RAISE NOTICE 'Locataire Aïssatou Fall créé pour M101';
    END IF;

    -- Locataire 4: Cheikh Ndiaye (pour unit5_id - O101)
    IF unit5_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants WHERE unit_id = unit5_id) THEN
        tenant5_id := gen_random_uuid();
        INSERT INTO tenants (
            id, organization_id, unit_id, first_name, last_name, phone, email, id_number, has_extranet_access, language, created_at
        ) VALUES (
            tenant5_id, org_id, unit5_id, 'Cheikh', 'Ndiaye', '+221 77 456 78 90', 'cheikh.ndiaye@gmail.com', 'SN456789012', true, 'fr', '2023-06-20'::TIMESTAMP
        );
        
        lease5_id := gen_random_uuid();
        INSERT INTO leases (
            id, organization_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_paid, signed, created_at
        ) VALUES (
            lease5_id, org_id, unit5_id, tenant5_id, '2023-06-20'::DATE, '2024-06-20'::DATE, 380000, true, true, '2023-06-20'::TIMESTAMP
        );
        RAISE NOTICE 'Locataire Cheikh Ndiaye créé pour O101';
    END IF;

    RAISE NOTICE '✓ Locataires spécifiques créés';
END $$;

-- Afficher un résumé
SELECT 
    'Résumé' as info,
    COUNT(DISTINCT t.id) as total_tenants,
    COUNT(DISTINCT CASE WHEN t.has_extranet_access THEN t.id END) as tenants_with_extranet,
    COUNT(DISTINCT l.id) as total_leases,
    COUNT(DISTINCT CASE WHEN l.signed THEN l.id END) as signed_leases,
    COUNT(DISTINCT CASE WHEN l.deposit_paid THEN l.id END) as deposits_paid,
    COUNT(DISTINCT CASE WHEN l.end_date >= CURRENT_DATE THEN l.id END) as active_leases
FROM tenants t
LEFT JOIN leases l ON l.tenant_id = t.id
WHERE t.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';

