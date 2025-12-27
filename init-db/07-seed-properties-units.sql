-- =====================================================
-- 07-seed-properties-units.sql
-- Script pour générer des données réelles de propriétés et unités
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

-- Créer les propriétés et unités
DO $$
DECLARE
    prop1_id UUID;
    prop2_id UUID;
    prop3_id UUID;
    prop4_id UUID;
    prop5_id UUID;
    org_id UUID := '098bc34f-130a-47d6-913c-fe5a93b02333';
BEGIN
    -- 1. Résidence Les Almadies
    INSERT INTO properties (
        organization_id,
        name,
        address,
        city,
        property_type,
        total_units,
        photo_urls,
        notes
    ) VALUES (
        org_id,
        'Résidence Les Almadies',
        'Route de l''Aéroport, Almadies',
        'Dakar',
        'residential',
        12,
        ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'],
        'Résidence moderne avec vue sur l''océan. Proximité de l''aéroport et des plages.'
    ) RETURNING id INTO prop1_id;

    -- 2. Immeuble Plateau
    INSERT INTO properties (
        organization_id,
        name,
        address,
        city,
        property_type,
        total_units,
        photo_urls,
        notes
    ) VALUES (
        org_id,
        'Immeuble Plateau',
        'Avenue Cheikh Anta Diop, Plateau',
        'Dakar',
        'residential',
        8,
        ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        'Immeuble situé dans le quartier d''affaires du Plateau. Proche des administrations.'
    ) RETURNING id INTO prop2_id;

    -- 3. Villa Sacré-Cœur
    INSERT INTO properties (
        organization_id,
        name,
        address,
        city,
        property_type,
        total_units,
        photo_urls,
        notes
    ) VALUES (
        org_id,
        'Villa Sacré-Cœur',
        'Rue 10, Sacré-Cœur 3',
        'Dakar',
        'residential',
        1,
        ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'],
        'Villa individuelle avec jardin. Quartier résidentiel calme.'
    ) RETURNING id INTO prop3_id;

    -- 4. Résidence Mermoz
    INSERT INTO properties (
        organization_id,
        name,
        address,
        city,
        property_type,
        total_units,
        photo_urls,
        notes
    ) VALUES (
        org_id,
        'Résidence Mermoz',
        'Avenue Cheikh Ibra Fall, Mermoz',
        'Dakar',
        'residential',
        6,
        ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'],
        'Résidence avec parking sécurisé. Proche des écoles et commerces.'
    ) RETURNING id INTO prop4_id;

    -- 5. Immeuble Ouakam
    INSERT INTO properties (
        organization_id,
        name,
        address,
        city,
        property_type,
        total_units,
        photo_urls,
        notes
    ) VALUES (
        org_id,
        'Immeuble Ouakam',
        'Boulevard de la République, Ouakam',
        'Dakar',
        'residential',
        10,
        ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'],
        'Immeuble face à la mer. Vue panoramique sur l''océan Atlantique.'
    ) RETURNING id INTO prop5_id;

    -- Unités pour Résidence Les Almadies (12 unités)
    INSERT INTO units (organization_id, property_id, unit_number, floor, surface, rent_amount, charges_amount, deposit_amount, status) VALUES
    (org_id, prop1_id, 'A101', '1er étage', 85, 450000, 50000, 900000, 'occupied'),
    (org_id, prop1_id, 'A102', '1er étage', 85, 450000, 50000, 900000, 'occupied'),
    (org_id, prop1_id, 'A201', '2ème étage', 95, 550000, 60000, 1100000, 'occupied'),
    (org_id, prop1_id, 'A202', '2ème étage', 95, 550000, 60000, 1100000, 'occupied'),
    (org_id, prop1_id, 'A301', '3ème étage', 110, 650000, 70000, 1300000, 'occupied'),
    (org_id, prop1_id, 'A302', '3ème étage', 110, 650000, 70000, 1300000, 'vacant'),
    (org_id, prop1_id, 'A401', '4ème étage', 120, 750000, 80000, 1500000, 'occupied'),
    (org_id, prop1_id, 'A402', '4ème étage', 120, 750000, 80000, 1500000, 'occupied'),
    (org_id, prop1_id, 'A501', '5ème étage', 130, 850000, 90000, 1700000, 'occupied'),
    (org_id, prop1_id, 'A502', '5ème étage', 130, 850000, 90000, 1700000, 'reserved'),
    (org_id, prop1_id, 'A601', '6ème étage', 140, 950000, 100000, 1900000, 'occupied'),
    (org_id, prop1_id, 'A602', '6ème étage', 140, 950000, 100000, 1900000, 'occupied');

    -- Unités pour Immeuble Plateau (8 unités)
    INSERT INTO units (organization_id, property_id, unit_number, floor, surface, rent_amount, charges_amount, deposit_amount, status) VALUES
    (org_id, prop2_id, 'B101', '1er étage', 70, 400000, 45000, 800000, 'occupied'),
    (org_id, prop2_id, 'B102', '1er étage', 70, 400000, 45000, 800000, 'occupied'),
    (org_id, prop2_id, 'B201', '2ème étage', 80, 480000, 55000, 960000, 'occupied'),
    (org_id, prop2_id, 'B202', '2ème étage', 80, 480000, 55000, 960000, 'occupied'),
    (org_id, prop2_id, 'B301', '3ème étage', 90, 550000, 60000, 1100000, 'occupied'),
    (org_id, prop2_id, 'B302', '3ème étage', 90, 550000, 60000, 1100000, 'vacant'),
    (org_id, prop2_id, 'B401', '4ème étage', 100, 620000, 70000, 1240000, 'occupied'),
    (org_id, prop2_id, 'B402', '4ème étage', 100, 620000, 70000, 1240000, 'maintenance');

    -- Unité pour Villa Sacré-Cœur (1 unité)
    INSERT INTO units (organization_id, property_id, unit_number, floor, surface, rent_amount, charges_amount, deposit_amount, status) VALUES
    (org_id, prop3_id, 'Villa', 'RDC + 2 étages', 250, 1200000, 150000, 2400000, 'occupied');

    -- Unités pour Résidence Mermoz (6 unités)
    INSERT INTO units (organization_id, property_id, unit_number, floor, surface, rent_amount, charges_amount, deposit_amount, status) VALUES
    (org_id, prop4_id, 'M101', '1er étage', 75, 420000, 48000, 840000, 'occupied'),
    (org_id, prop4_id, 'M102', '1er étage', 75, 420000, 48000, 840000, 'occupied'),
    (org_id, prop4_id, 'M201', '2ème étage', 85, 500000, 58000, 1000000, 'occupied'),
    (org_id, prop4_id, 'M202', '2ème étage', 85, 500000, 58000, 1000000, 'occupied'),
    (org_id, prop4_id, 'M301', '3ème étage', 95, 580000, 65000, 1160000, 'occupied'),
    (org_id, prop4_id, 'M302', '3ème étage', 95, 580000, 65000, 1160000, 'vacant');

    -- Unités pour Immeuble Ouakam (10 unités)
    INSERT INTO units (organization_id, property_id, unit_number, floor, surface, rent_amount, charges_amount, deposit_amount, status) VALUES
    (org_id, prop5_id, 'O101', '1er étage', 65, 380000, 40000, 760000, 'occupied'),
    (org_id, prop5_id, 'O102', '1er étage', 65, 380000, 40000, 760000, 'occupied'),
    (org_id, prop5_id, 'O201', '2ème étage', 75, 450000, 50000, 900000, 'occupied'),
    (org_id, prop5_id, 'O202', '2ème étage', 75, 450000, 50000, 900000, 'occupied'),
    (org_id, prop5_id, 'O301', '3ème étage', 85, 520000, 58000, 1040000, 'occupied'),
    (org_id, prop5_id, 'O302', '3ème étage', 85, 520000, 58000, 1040000, 'occupied'),
    (org_id, prop5_id, 'O401', '4ème étage', 95, 600000, 65000, 1200000, 'occupied'),
    (org_id, prop5_id, 'O402', '4ème étage', 95, 600000, 65000, 1200000, 'reserved'),
    (org_id, prop5_id, 'O501', '5ème étage', 105, 680000, 75000, 1360000, 'occupied'),
    (org_id, prop5_id, 'O502', '5ème étage', 105, 680000, 75000, 1360000, 'occupied');

    RAISE NOTICE '✓ Propriétés et unités créées avec succès';
    RAISE NOTICE '  - Résidence Les Almadies: 12 unités';
    RAISE NOTICE '  - Immeuble Plateau: 8 unités';
    RAISE NOTICE '  - Villa Sacré-Cœur: 1 unité';
    RAISE NOTICE '  - Résidence Mermoz: 6 unités';
    RAISE NOTICE '  - Immeuble Ouakam: 10 unités';
    RAISE NOTICE '  Total: 37 unités';
END $$;

-- Afficher un résumé
SELECT 
    'Résumé' as info,
    COUNT(DISTINCT p.id) as total_properties,
    COUNT(u.id) as total_units,
    COUNT(CASE WHEN u.status = 'occupied' THEN 1 END) as units_occupied,
    COUNT(CASE WHEN u.status = 'vacant' THEN 1 END) as units_vacant,
    COUNT(CASE WHEN u.status = 'reserved' THEN 1 END) as units_reserved,
    COUNT(CASE WHEN u.status = 'maintenance' THEN 1 END) as units_maintenance,
    ROUND(SUM(u.rent_amount::numeric)) as total_monthly_rent_fcfa
FROM properties p
LEFT JOIN units u ON u.property_id = p.id
WHERE p.organization_id = '098bc34f-130a-47d6-913c-fe5a93b02333';
