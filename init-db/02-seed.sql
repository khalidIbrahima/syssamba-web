-- 02-seed.sql – Données de démo corrigées (décembre 2025)
-- Exécuter après 01-schema.sql

-- Organisation 1 : Agence type Pro (150 lots)
INSERT INTO organizations (
    id, name, slug, type, plan, 
    lots_limit, users_limit, extranet_tenants_limit
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Teranga Immobilier',
    'teranga-immo',
    'agency',
    'pro',
    150,
    5,
    300
);

-- Organisation 2 : SCI familiale Starter
INSERT INTO organizations (
    id, name, slug, type, plan, 
    lots_limit, users_limit, extranet_tenants_limit
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'SCI Dieng Family',
    'sci-dieng',
    'sci',
    'starter',
    30,
    2,
    50
);

-- Méthodes de paiement pré-configurées pour Teranga Immobilier
INSERT INTO payment_methods (
    organization_id, name, slug, provider, is_active, is_default, visible_to_tenants,
    config, fee_type, fee_value
) VALUES 
('11111111-1111-1111-1111-111111111111', 'Wave Sénégal',         'wave_sn',        'wave',         true,  true,  true,  '{"merchant_id": "TEST123", "api_key": "test_key"}', 'percent', 1.8),
('11111111-1111-1111-1111-111111111111', 'Orange Money SN',      'orange_sn',      'orange_money', true,  false, true,  '{"phone": "781234567"}',                            'percent', 1.5),
('11111111-1111-1111-1111-111111111111', 'Virement bancaire',    'bank_transfer',  'bank_transfer',true,  false, true,  '{"iban": "SN12 3456 7890 1234 5678 901", "bic": "BCAOSNDA"}', 'none', 0),
('11111111-1111-1111-1111-111111111111', 'Espèces',              'cash',           'cash',         true,  false, false, '{}',                                               'none', 0);

-- Quelques comptes SYSCOHADA utiles (si la table est vide)
INSERT INTO accounts (account_number, label, category) VALUES
('7012', 'Loyers perçus', '7'),
('7073', 'Charges récupérables', '7'),
('5121', 'Banque', '5'),
('44581', 'TVA collectée 18%', '4'),
('614', 'Entretien et réparations', '6')
ON CONFLICT (account_number) DO NOTHING;

-- Message de succès (optionnel)
SELECT '✅ SAMBA ONE – Base de données initialisée avec succès ! 2 organisations + 4 méthodes de paiement + comptes SYSCOHADA' AS status;