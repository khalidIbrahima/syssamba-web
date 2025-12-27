-- =====================================================
-- 10-seed-journal-entries.sql
-- Script pour générer des écritures comptables de test
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

-- Créer des comptes SYSCOHADA de base s'ils n'existent pas
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
('445.002', 'TVA déductible', '4', true)
ON CONFLICT (account_number) DO NOTHING;

-- Fonction pour créer une écriture avec ses lignes
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
    entry_date DATE;
    ref_counter INTEGER := 1;
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

    -- Écriture 1: Encaissement loyer Décembre - Apt 15B (350,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Apt 15B', 'LOY-2024-001', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 350000, 0, 'Loyer Décembre - Apt 15B'),
    (entry_id, account_701_001, 0, 350000, 'Loyer Décembre - Apt 15B');

    -- Écriture 2: Encaissement loyer Décembre - Villa Mermoz (450,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    ref_counter := ref_counter + 1;
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Villa Mermoz', 'LOY-2024-002', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 450000, 0, 'Loyer Décembre - Villa Mermoz'),
    (entry_id, account_701_001, 0, 450000, 'Loyer Décembre - Villa Mermoz');

    -- Écriture 3: Charges syndic Immeuble A (125,000 FCFA)
    entry_date := '2024-12-14';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Charges syndic Immeuble A', 'CHG-2024-045', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_604_001, 125000, 0, 'Charges syndic Immeuble A'),
    (entry_id, account_401_001, 0, 125000, 'Charges syndic Immeuble A');

    -- Écriture 4: Encaissement Wave Mobile (280,000 FCFA)
    entry_date := '2024-12-13';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Encaissement Wave Mobile', 'ENC-2024-012', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_512_002, 280000, 0, 'Encaissement Wave Mobile'),
    (entry_id, account_411_002, 0, 280000, 'Encaissement Wave Mobile');

    -- Écriture 5: Loyer Décembre - Résidence Almadies (400,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Résidence Almadies Apt 3A', 'LOY-2024-003', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 400000, 0, 'Loyer Décembre - Résidence Almadies Apt 3A'),
    (entry_id, account_701_001, 0, 400000, 'Loyer Décembre - Résidence Almadies Apt 3A');

    -- Écriture 6: Réparation plomberie (75,000 FCFA)
    entry_date := '2024-12-12';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Réparation plomberie - Studio HLM', 'REP-2024-008', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_604_003, 75000, 0, 'Réparation plomberie - Studio HLM'),
    (entry_id, account_512_001, 0, 75000, 'Réparation plomberie - Studio HLM');

    -- Écriture 7: Loyer Décembre - Plateau Bureau 15 (750,000 FCFA)
    entry_date := '2024-12-14';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Plateau Bureau 15', 'LOY-2024-004', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 750000, 0, 'Loyer Décembre - Plateau Bureau 15'),
    (entry_id, account_701_001, 0, 750000, 'Loyer Décembre - Plateau Bureau 15');

    -- Écriture 8: Loyer Décembre - Villa Ouakam (1,200,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Villa Ouakam', 'LOY-2024-005', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 1200000, 0, 'Loyer Décembre - Villa Ouakam'),
    (entry_id, account_701_001, 0, 1200000, 'Loyer Décembre - Villa Ouakam');

    -- Écriture 9: Charges entretien (50,000 FCFA)
    entry_date := '2024-12-11';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Charges entretien - Immeuble B', 'CHG-2024-046', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_604_002, 50000, 0, 'Charges entretien - Immeuble B'),
    (entry_id, account_401_001, 0, 50000, 'Charges entretien - Immeuble B');

    -- Écriture 10: Loyer Décembre - Résidence Almadies Apt 2A (450,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Résidence Almadies Apt 2A', 'LOY-2024-006', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 450000, 0, 'Loyer Décembre - Résidence Almadies Apt 2A'),
    (entry_id, account_701_001, 0, 450000, 'Loyer Décembre - Résidence Almadies Apt 2A');

    -- Écriture 11: Loyer Décembre - Résidence Almadies Apt 5B (500,000 FCFA)
    entry_date := '2024-12-15';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Loyer Décembre - Résidence Almadies Apt 5B', 'LOY-2024-007', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_411_001, 500000, 0, 'Loyer Décembre - Résidence Almadies Apt 5B'),
    (entry_id, account_701_001, 0, 500000, 'Loyer Décembre - Résidence Almadies Apt 5B');

    -- Écriture 12: Virement bancaire reçu (600,000 FCFA)
    entry_date := '2024-12-13';
    entry_id := uuid_generate_v4();
    
    INSERT INTO journal_entries (id, organization_id, entry_date, description, reference, validated)
    VALUES (entry_id, org_id, entry_date, 'Virement bancaire - Client', 'VIR-2024-003', true);
    
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (entry_id, account_512_001, 600000, 0, 'Virement bancaire - Client'),
    (entry_id, account_411_001, 0, 600000, 'Virement bancaire - Client');

    RAISE NOTICE '✅ % écritures comptables créées avec succès!', 12;
END $$;

-- Vérification: Afficher le nombre d'écritures créées
SELECT 
    COUNT(*) as total_entries,
    COUNT(DISTINCT entry_id) as unique_entries,
    SUM(CASE WHEN debit::numeric > 0 THEN debit::numeric ELSE 0 END) as total_debit,
    SUM(CASE WHEN credit::numeric > 0 THEN credit::numeric ELSE 0 END) as total_credit
FROM journal_lines jl
INNER JOIN journal_entries je ON jl.entry_id = je.id
WHERE je.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';

