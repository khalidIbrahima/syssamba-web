# Migration de géolocalisation

## Scripts disponibles

### 1. `30-update-geolocation-schema.sql`
**Script principal de migration du schéma**

Ce script :
- ✅ Ajoute les colonnes `latitude` et `longitude` à la table `properties` (si elles n'existent pas)
- ✅ Supprime les colonnes `latitude` et `longitude` de la table `units` (si elles existent)
- ✅ Crée un index spatial pour améliorer les performances
- ✅ Ajoute la table `properties` à la publication Supabase Realtime
- ✅ Affiche un résumé des biens avec/sans coordonnées

**Usage:**
```bash
psql -U votre_user -d votre_database -f init-db/30-update-geolocation-schema.sql
```

### 2. `31-batch-update-geocoordinates.sql`
**Script de référence pour mises à jour manuelles**

Ce script contient des exemples de requêtes SQL pour :
- Mise à jour manuelle des coordonnées
- Vérification des biens sans coordonnées
- Statistiques sur les coordonnées

**Note:** Pour une mise à jour automatique, utilisez plutôt le script TypeScript :
```bash
npm run update-geocoordinates -- --all
```

### 3. `32-geocode-properties-from-address.sql`
**Script SQL pour géocoder automatiquement toutes les propriétés**

Ce script :
- ✅ Crée une fonction `geocode_address()` pour géocoder une adresse via l'API Nominatim
- ✅ Crée une fonction `update_property_coordinates()` pour mettre à jour une propriété spécifique
- ✅ Crée une fonction `geocode_all_properties()` pour géocoder toutes les propriétés sans coordonnées
- ✅ Respecte la limite de taux de Nominatim (1 requête/seconde)
- ✅ Affiche un résumé avec le nombre de succès/échecs

**Prérequis:**
```sql
-- Installer l'extension http (si disponible)
CREATE EXTENSION IF NOT EXISTS http;
```

**Usage:**
```sql
-- Géocoder toutes les propriétés
SELECT * FROM geocode_all_properties();

-- Géocoder une propriété spécifique
SELECT update_property_coordinates('VOTRE_UUID_ICI');
```

**Note:** Si l'extension http n'est pas disponible, utilisez le script TypeScript :
```bash
npm run update-geocoordinates -- --all
```

## Architecture

### Table `properties`
- `latitude` : DECIMAL(10, 8) - Latitude du bien (WGS84)
- `longitude` : DECIMAL(11, 8) - Longitude du bien (WGS84)

### Table `units`
- ❌ **Pas de colonnes latitude/longitude**
- Les lots utilisent les coordonnées de leur bien parent via `property_id`

## Mise à jour des coordonnées

### Méthode recommandée : Script TypeScript
```bash
# Mettre à jour tous les biens
npm run update-geocoordinates -- --all

# Mettre à jour un bien spécifique
npm run update-geocoordinates -- --property-id=<UUID>
```

### Méthode SQL : Script automatique (PostgreSQL autonome uniquement)
⚠️ **Note:** Cette méthode ne fonctionne PAS sur Supabase (l'extension http n'est pas disponible).

```sql
-- 1. Installer l'extension http (PostgreSQL autonome uniquement)
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Exécuter le script de géocodage
\i init-db/32-geocode-properties-from-address.sql

-- 3. Géocoder toutes les propriétés
SELECT * FROM geocode_all_properties();

-- Ou géocoder une propriété spécifique
SELECT update_property_coordinates('VOTRE_UUID_ICI');
```

### Méthode Supabase : Script de préparation
Pour Supabase, utilisez le script de préparation qui crée des vues et fonctions utiles:

```sql
-- Exécuter le script de préparation Supabase
\i init-db/33-supabase-geocode-helper.sql

-- Vérifier les propriétés sans coordonnées
SELECT * FROM properties_missing_coordinates;

-- Voir les statistiques
SELECT * FROM properties_geolocation_stats;

-- Puis utiliser le script TypeScript
npm run update-geocoordinates -- --all
```

### Méthode alternative : Mise à jour manuelle SQL
```sql
UPDATE properties 
SET 
    latitude = 14.7167,
    longitude = -17.4677
WHERE id = 'VOTRE_UUID_ICI';
```

## Vérification

Pour vérifier l'état des coordonnées :
```sql
SELECT 
    COUNT(*) AS total,
    COUNT(latitude) AS with_lat,
    COUNT(longitude) AS with_lon,
    COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS complete
FROM properties;
```

