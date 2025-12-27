-- =====================================================
-- 24-clean-export-for-supabase.sql
-- Script pour nettoyer un export pg_dump avant import dans Supabase
-- =====================================================
-- 
-- Ce script contient des commandes SQL utiles pour nettoyer
-- un export pg_dump avant de l'importer dans Supabase.
-- 
-- Utilisation:
--   1. Exportez vos données: pg_dump $DATABASE_URL --data-only > export.sql
--   2. Ouvrez export.sql dans un éditeur
--   3. Appliquez les modifications ci-dessous
--   4. Importez dans Supabase
-- =====================================================

-- =====================================================
-- 1. Désactiver temporairement les contraintes
-- =====================================================
-- Ajoutez ces lignes au début de votre fichier SQL

SET session_replication_role = 'replica';

-- =====================================================
-- 2. Supprimer les commandes incompatibles
-- =====================================================
-- Recherchez et supprimez ces lignes dans votre export:
-- 
-- - SET statement_timeout = 0;
-- - SET lock_timeout = 0;
-- - SET idle_in_transaction_session_timeout = 0;
-- - SET client_encoding = 'UTF8';
-- - SET standard_conforming_strings = on;
-- - SELECT pg_catalog.set_config('search_path', '', false);
-- - SET check_function_bodies = false;
-- - SET xmloption = content;
-- - SET client_min_messages = warning;
-- - SET row_security = off;
-- 
-- Ces commandes sont spécifiques à PostgreSQL et peuvent causer
-- des erreurs dans Supabase.

-- =====================================================
-- 3. Réinitialiser les séquences (si nécessaire)
-- =====================================================
-- Si vous utilisez des séquences (pas le cas avec UUID), ajoutez:

-- SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
-- SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));
-- ... etc

-- =====================================================
-- 4. Réactiver les contraintes
-- =====================================================
-- Ajoutez cette ligne à la fin de votre fichier SQL

SET session_replication_role = 'origin';

-- =====================================================
-- 5. Vérification post-import
-- =====================================================
-- Après l'import, exécutez ces requêtes pour vérifier:

-- Vérifier le nombre d'enregistrements
SELECT 
  'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'properties', COUNT(*) FROM properties
UNION ALL
SELECT 'units', COUNT(*) FROM units
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

-- Vérifier les relations
SELECT 
  o.name as organization_name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT p.id) as property_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
LEFT JOIN properties p ON p.organization_id = o.id
GROUP BY o.id, o.name;

-- =====================================================
-- 6. Exemple de commande pg_dump nettoyée
-- =====================================================
-- 
-- pg_dump $DATABASE_URL \
--   --data-only \
--   --column-inserts \
--   --no-owner \
--   --no-privileges \
--   --no-tablespaces \
--   --no-security-labels \
--   > export.sql
-- 
-- Puis nettoyez export.sql avec les instructions ci-dessus.

