# Scripts de Migration - Table Plans

Ce dossier contient les scripts pour créer et peupler la table `plans` dans la base de données.

## 📋 Fichiers disponibles

1. **`init-db/03-plans.sql`** - Script SQL pur pour créer et peupler la table plans
2. **`scripts/migrate-plans.ts`** - Script TypeScript utilisant Drizzle ORM pour migrer les plans

## 🚀 Utilisation

### Option 1 : Script SQL (Recommandé pour production)

```bash
# Se connecter à PostgreSQL
psql -U postgres -d sambaone -f init-db/03-plans.sql

# Ou via Docker
docker exec -i sambaone-db psql -U postgres -d sambaone < init-db/03-plans.sql
```

### Option 2 : Script TypeScript (Développement)

```bash
# Installer tsx si nécessaire
npm install -g tsx

# Exécuter le script
npx tsx scripts/migrate-plans.ts
```

## 📊 Structure de la table

La table `plans` contient :

- **Identifiants** : `id`, `name` (unique)
- **Informations** : `display_name`, `price`, `price_type`
- **Limites** : `lots_limit`, `users_limit`, `extranet_tenants_limit`
- **Fonctionnalités** : `features` (JSONB)
- **Support** : `support_level`
- **Métadonnées** : `is_active`, `sort_order`, `created_at`, `updated_at`

## 🔄 Plans disponibles

1. **Freemium** - 0 FCFA/mois
   - 5 lots, 1 utilisateur, 5 locataires extranet
   - Fonctionnalités de base

2. **Starter** - 9,900 FCFA/mois
   - 30 lots, 2 utilisateurs, 50 locataires extranet
   - Comptabilité SYSCOHADA basique

3. **Pro** - 29,900 FCFA/mois
   - 150 lots, 5 utilisateurs, 300 locataires extranet
   - Comptabilité complète, DSF, signature électronique

4. **Agence / Syndic** - 79,900 FCFA/mois
   - Lots illimités, 15 utilisateurs, locataires illimités
   - Domaine personnalisé, marque blanche

5. **Enterprise** - Sur devis
   - Tout illimité
   - Marque blanche complète, API, support dédié

## ⚠️ Notes importantes

- Le script SQL utilise `ON CONFLICT DO UPDATE` pour éviter les doublons
- Les features sont stockées en JSONB pour flexibilité
- Les limites `NULL` signifient "illimité"
- Le script TypeScript lit depuis `PLAN_DEFINITIONS` dans `src/lib/permissions.ts`

## 🔍 Vérification

Après exécution, vérifiez que les plans sont bien créés :

```sql
SELECT name, display_name, price, lots_limit, users_limit 
FROM plans 
ORDER BY sort_order;
```

