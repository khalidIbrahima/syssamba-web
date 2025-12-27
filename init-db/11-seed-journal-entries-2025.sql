-- =====================================================
-- 11-seed-journal-entries-2025.sql
-- Script pour générer des écritures comptables de test pour 2025
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

-- S'assurer que les comptes SYSCOHADA existent
INSERT INTO accounts (account_number, label, category, is_active) VALUES
('411.001', 'Clients - Loyers', '4', true),
('411.002', 'Clients - Autres', '4', true),
('401.001', 'Fournisseurs - Charges', '4', true),
('512.001', 'Banque - Compte principal', '5', true),
('512.002', 'Banque - Wave', '5', true),
('701.001', 'Produits - Loyers perçus', '7', true),
('604.001', 'Charges - Syndic', '6', true),
('604.002', 'Charges - Entretien', '6', true),
('604.003', 'Charges - Réparations', '6', true),
('445.001', 'TVA collectée', '4', true),
('445.002', 'TVA déductible', '4', true),
('531.001', 'Caisse', '5', true)
ON CONFLICT (account_number) DO NOTHING;

-- Fonction pour créer des écritures pour 2025
DO $$
DECLARE
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
    entry_id UUID;
    account_411_001 UUID;
    account_411_002 UUID;
    account_401_001 UUID;
    account_512_001 UUID;
    account_512_002 UUID;
    account_701_001 UUID;
    account_604_001 UUID;
    account_604_002 UUID;
    account_604_003 UUID;
    account_531_001 UUID;
    entry_date DATE;
    month_num INTEGER;
    day_num INTEGER;
    ref_counter INTEGER;
    loyer_amount DECIMAL;
    charge_amount DECIMAL;
    repair_amount DECIMAL;
BEGIN
    -- Récupérer les IDs des comptes
    SELECT id INTO account_411_001 FROM accounts WHERE account_number = '411.001';
    SELECT id INTO account_411_002 FROM accounts WHERE account_number = '411.002';
    SELECT id INTO account_401_001 FROM accounts WHERE account_number = '401.001';
    SELECT id INTO account_512_001 FROM accounts WHERE account_number = '512.001';
    SELECT id INTO account_512_002 FROM accounts WHERE account_number = '512.002';
    SELECT id INTO account_701_001 FROM accounts WHERE account_number = '701.001';
    SELECT id INTO account_604_001 FROM accounts WHERE account_number = '604.001';
    SELECT id INTO account_604_002 FROM accounts WHERE account_number = '604.002';
    SELECT id INTO account_604_003 FROM accounts WHERE account_number = '604.003';
    SELECT id INTO account_531_001 FROM accounts WHERE account_number = '531.001';

    -- Générer des écritures pour chaque mois de 2025
    FOR month_num IN 1..12 LOOP
        ref_counter := 1;
        
        -- JANVIER 2025
        IF month_num = 1 THEN
            -- Loyer Janvier - Apt 15B (350,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Apt 15B', 'LOY-2025-001', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 350000, 0, 'Loyer Janvier - Apt 15B'),
            (entry_id, account_701_001, 0, 350000, 'Loyer Janvier - Apt 15B');

            -- Loyer Janvier - Villa Mermoz (450,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Villa Mermoz', 'LOY-2025-002', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 450000, 0, 'Loyer Janvier - Villa Mermoz'),
            (entry_id, account_701_001, 0, 450000, 'Loyer Janvier - Villa Mermoz');

            -- Loyer Janvier - Résidence Almadies Apt 3A (400,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Résidence Almadies Apt 3A', 'LOY-2025-003', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 400000, 0, 'Loyer Janvier - Résidence Almadies Apt 3A'),
            (entry_id, account_701_001, 0, 400000, 'Loyer Janvier - Résidence Almadies Apt 3A');

            -- Loyer Janvier - Plateau Bureau 15 (750,000 FCFA)
            entry_date := '2025-01-14';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Plateau Bureau 15', 'LOY-2025-004', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 750000, 0, 'Loyer Janvier - Plateau Bureau 15'),
            (entry_id, account_701_001, 0, 750000, 'Loyer Janvier - Plateau Bureau 15');

            -- Loyer Janvier - Villa Ouakam (1,200,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Villa Ouakam', 'LOY-2025-005', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 1200000, 0, 'Loyer Janvier - Villa Ouakam'),
            (entry_id, account_701_001, 0, 1200000, 'Loyer Janvier - Villa Ouakam');

            -- Loyer Janvier - Résidence Almadies Apt 2A (450,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Résidence Almadies Apt 2A', 'LOY-2025-006', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 450000, 0, 'Loyer Janvier - Résidence Almadies Apt 2A'),
            (entry_id, account_701_001, 0, 450000, 'Loyer Janvier - Résidence Almadies Apt 2A');

            -- Loyer Janvier - Résidence Almadies Apt 5B (500,000 FCFA)
            entry_date := '2025-01-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Janvier - Résidence Almadies Apt 5B', 'LOY-2025-007', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 500000, 0, 'Loyer Janvier - Résidence Almadies Apt 5B'),
            (entry_id, account_701_001, 0, 500000, 'Loyer Janvier - Résidence Almadies Apt 5B');

            -- Charges syndic Immeuble A (125,000 FCFA)
            entry_date := '2025-01-14';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Charges syndic Immeuble A - Janvier', 'CHG-2025-001', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_604_001, 125000, 0, 'Charges syndic Immeuble A - Janvier'),
            (entry_id, account_401_001, 0, 125000, 'Charges syndic Immeuble A - Janvier');

            -- Encaissement Wave Mobile (280,000 FCFA)
            entry_date := '2025-01-13';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Encaissement Wave Mobile - Janvier', 'ENC-2025-001', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_512_002, 280000, 0, 'Encaissement Wave Mobile - Janvier'),
            (entry_id, account_411_002, 0, 280000, 'Encaissement Wave Mobile - Janvier');

            -- Virement bancaire reçu (600,000 FCFA)
            entry_date := '2025-01-13';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Virement bancaire - Client Janvier', 'VIR-2025-001', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_512_001, 600000, 0, 'Virement bancaire - Client Janvier'),
            (entry_id, account_411_001, 0, 600000, 'Virement bancaire - Client Janvier');
        END IF;

        -- FÉVRIER 2025
        IF month_num = 2 THEN
            -- Loyers Février
            FOR day_num IN 14..15 LOOP
                entry_date := '2025-02-' || LPAD(day_num::TEXT, 2, '0');
                
                -- Apt 15B
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer Février - Apt 15B', 'LOY-2025-008', true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 350000, 0, 'Loyer Février - Apt 15B'),
                (entry_id, account_701_001, 0, 350000, 'Loyer Février - Apt 15B');

                -- Villa Mermoz
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer Février - Villa Mermoz', 'LOY-2025-009', true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 450000, 0, 'Loyer Février - Villa Mermoz'),
                (entry_id, account_701_001, 0, 450000, 'Loyer Février - Villa Mermoz');

                -- Résidence Almadies Apt 3A
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer Février - Résidence Almadies Apt 3A', 'LOY-2025-010', true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 400000, 0, 'Loyer Février - Résidence Almadies Apt 3A'),
                (entry_id, account_701_001, 0, 400000, 'Loyer Février - Résidence Almadies Apt 3A');
            END LOOP;

            -- Plateau Bureau 15
            entry_date := '2025-02-14';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Février - Plateau Bureau 15', 'LOY-2025-011', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 750000, 0, 'Loyer Février - Plateau Bureau 15'),
            (entry_id, account_701_001, 0, 750000, 'Loyer Février - Plateau Bureau 15');

            -- Villa Ouakam
            entry_date := '2025-02-15';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Loyer Février - Villa Ouakam', 'LOY-2025-012', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_411_001, 1200000, 0, 'Loyer Février - Villa Ouakam'),
            (entry_id, account_701_001, 0, 1200000, 'Loyer Février - Villa Ouakam');

            -- Charges syndic
            entry_date := '2025-02-14';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Charges syndic Immeuble A - Février', 'CHG-2025-002', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_604_001, 125000, 0, 'Charges syndic Immeuble A - Février'),
            (entry_id, account_401_001, 0, 125000, 'Charges syndic Immeuble A - Février');

            -- Réparation électricité
            entry_date := '2025-02-12';
            entry_id := uuid_generate_v4();
            INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
            VALUES (entry_id, org_id, entry_date, 'Réparation électricité - Studio HLM', 'REP-2025-001', true);
            INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
            (entry_id, account_604_003, 85000, 0, 'Réparation électricité - Studio HLM'),
            (entry_id, account_512_001, 0, 85000, 'Réparation électricité - Studio HLM');
        END IF;

        -- MARS à DÉCEMBRE 2025 - Génération automatique
        IF month_num >= 3 AND month_num <= 12 THEN
            -- Noms des mois
            DECLARE
                month_name TEXT;
                ref_num INTEGER;
                prop_name TEXT;
                prop_amount INTEGER;
            BEGIN
                month_name := CASE month_num
                    WHEN 3 THEN 'Mars'
                    WHEN 4 THEN 'Avril'
                    WHEN 5 THEN 'Mai'
                    WHEN 6 THEN 'Juin'
                    WHEN 7 THEN 'Juillet'
                    WHEN 8 THEN 'Août'
                    WHEN 9 THEN 'Septembre'
                    WHEN 10 THEN 'Octobre'
                    WHEN 11 THEN 'Novembre'
                    WHEN 12 THEN 'Décembre'
                END;

                ref_num := (month_num - 1) * 7 + 8; -- Numéro de référence basé sur le mois
                entry_date := '2025-' || LPAD(month_num::TEXT, 2, '0') || '-15';

                -- Loyers pour chaque propriété
                -- Apt 15B
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Apt 15B', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 350000, 0, 'Loyer ' || month_name || ' - Apt 15B'),
                (entry_id, account_701_001, 0, 350000, 'Loyer ' || month_name || ' - Apt 15B');
                ref_num := ref_num + 1;

                -- Villa Mermoz
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Villa Mermoz', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 450000, 0, 'Loyer ' || month_name || ' - Villa Mermoz'),
                (entry_id, account_701_001, 0, 450000, 'Loyer ' || month_name || ' - Villa Mermoz');
                ref_num := ref_num + 1;

                -- Résidence Almadies Apt 3A
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Résidence Almadies Apt 3A', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 400000, 0, 'Loyer ' || month_name || ' - Résidence Almadies Apt 3A'),
                (entry_id, account_701_001, 0, 400000, 'Loyer ' || month_name || ' - Résidence Almadies Apt 3A');
                ref_num := ref_num + 1;

                -- Plateau Bureau 15
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Plateau Bureau 15', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 750000, 0, 'Loyer ' || month_name || ' - Plateau Bureau 15'),
                (entry_id, account_701_001, 0, 750000, 'Loyer ' || month_name || ' - Plateau Bureau 15');
                ref_num := ref_num + 1;

                -- Villa Ouakam
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Villa Ouakam', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 1200000, 0, 'Loyer ' || month_name || ' - Villa Ouakam'),
                (entry_id, account_701_001, 0, 1200000, 'Loyer ' || month_name || ' - Villa Ouakam');
                ref_num := ref_num + 1;

                -- Résidence Almadies Apt 2A
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Résidence Almadies Apt 2A', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 450000, 0, 'Loyer ' || month_name || ' - Résidence Almadies Apt 2A'),
                (entry_id, account_701_001, 0, 450000, 'Loyer ' || month_name || ' - Résidence Almadies Apt 2A');
                ref_num := ref_num + 1;

                -- Résidence Almadies Apt 5B
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Loyer ' || month_name || ' - Résidence Almadies Apt 5B', 'LOY-2025-' || LPAD(ref_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_411_001, 500000, 0, 'Loyer ' || month_name || ' - Résidence Almadies Apt 5B'),
                (entry_id, account_701_001, 0, 500000, 'Loyer ' || month_name || ' - Résidence Almadies Apt 5B');

                -- Charges syndic mensuelles
                entry_date := '2025-' || LPAD(month_num::TEXT, 2, '0') || '-14';
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Charges syndic Immeuble A - ' || month_name, 'CHG-2025-' || LPAD(month_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_604_001, 125000, 0, 'Charges syndic Immeuble A - ' || month_name),
                (entry_id, account_401_001, 0, 125000, 'Charges syndic Immeuble A - ' || month_name);

                -- Charges entretien occasionnelles (tous les 2 mois)
                IF month_num % 2 = 0 THEN
                    entry_date := '2025-' || LPAD(month_num::TEXT, 2, '0') || '-11';
                    entry_id := uuid_generate_v4();
                    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                    VALUES (entry_id, org_id, entry_date, 'Charges entretien - Immeuble B - ' || month_name, 'CHG-2025-' || LPAD((50 + month_num)::TEXT, 3, '0'), true);
                    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                    (entry_id, account_604_002, 50000, 0, 'Charges entretien - Immeuble B - ' || month_name),
                    (entry_id, account_401_001, 0, 50000, 'Charges entretien - Immeuble B - ' || month_name);
                END IF;

                -- Réparations occasionnelles (tous les 3 mois)
                IF month_num % 3 = 0 THEN
                    entry_date := '2025-' || LPAD(month_num::TEXT, 2, '0') || '-12';
                    entry_id := uuid_generate_v4();
                    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                    VALUES (entry_id, org_id, entry_date, 'Réparation - ' || month_name, 'REP-2025-' || LPAD((month_num / 3)::TEXT, 2, '0'), true);
                    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                    (entry_id, account_604_003, 75000 + (month_num * 5000), 0, 'Réparation - ' || month_name),
                    (entry_id, account_512_001, 0, 75000 + (month_num * 5000), 'Réparation - ' || month_name);
                END IF;

                -- Encaissement Wave Mobile (tous les mois)
                entry_date := '2025-' || LPAD(month_num::TEXT, 2, '0') || '-13';
                entry_id := uuid_generate_v4();
                INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
                VALUES (entry_id, org_id, entry_date, 'Encaissement Wave Mobile - ' || month_name, 'ENC-2025-' || LPAD(month_num::TEXT, 3, '0'), true);
                INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
                (entry_id, account_512_002, 280000 + (month_num * 10000), 0, 'Encaissement Wave Mobile - ' || month_name),
                (entry_id, account_411_002, 0, 280000 + (month_num * 10000), 'Encaissement Wave Mobile - ' || month_name);
            END;
        END IF;
    END LOOP;

    RAISE NOTICE '✅ Écritures comptables 2025 créées avec succès!';
END $$;

-- Vérification: Afficher le nombre d'écritures créées pour 2025
SELECT 
    COUNT(DISTINCT je.id) as total_entries_2025,
    SUM(CASE WHEN jl.debit::numeric > 0 THEN jl.debit::numeric ELSE 0 END) as total_debit,
    SUM(CASE WHEN jl.credit::numeric > 0 THEN jl.credit::numeric ELSE 0 END) as total_credit,
    SUM(CASE WHEN jl.debit::numeric > 0 THEN jl.debit::numeric ELSE 0 END) - 
    SUM(CASE WHEN jl.credit::numeric > 0 THEN jl.credit::numeric ELSE 0 END) as balance
FROM journal_lines jl
INNER JOIN journal_entries je ON jl.entry_id = je.id
WHERE je.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333'
AND je.entry_date >= '2025-01-01'
AND je.entry_date <= '2025-12-31';

