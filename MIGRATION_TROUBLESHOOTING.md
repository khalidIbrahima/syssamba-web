# 🔧 Dépannage de la Migration

## ❌ Erreur : "SOURCE_DATABASE_URL or DATABASE_URL is not set"

### Solution 1 : Définir les variables dans PowerShell (Temporaire)

```powershell
# Remplacez par vos vraies valeurs
$env:SOURCE_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/samba_one"
$env:TARGET_DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# Puis exécutez
npm run migrate:to-supabase
```

### Solution 2 : Ajouter dans `.env.local` (Permanent)

Créez ou modifiez `.env.local` à la racine du projet :

```env
# Source : votre base PostgreSQL locale
SOURCE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/samba_one

# Target : votre Supabase
TARGET_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

Puis exécutez :
```powershell
npm run migrate:to-supabase
```

## ❌ Erreur : "TARGET_DATABASE_URL or SUPABASE_DB_URL is not set"

Même solution que ci-dessus, mais assurez-vous que `TARGET_DATABASE_URL` est défini.

## ❌ Erreur de connexion à la base source

**Vérifiez** :
1. Que PostgreSQL est démarré
2. Que la connection string est correcte
3. Que le nom de la base de données existe

**Test de connexion** :
```powershell
# Testez avec psql (si installé)
psql "postgresql://postgres:postgres@localhost:5432/samba_one" -c "SELECT 1;"
```

## ❌ Erreur de connexion à Supabase

**Vérifiez** :
1. Que la connection string Supabase est correcte
2. Que votre IP est autorisée dans Supabase (Settings > Database > Connection pooling)
3. Que le mot de passe est correct

**Test de connexion** :
```powershell
# Testez avec psql (si installé)
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres" -c "SELECT 1;"
```

## ❌ Erreur : "Table does not exist"

**Solution** : Les tables doivent être créées dans Supabase avant la migration.

1. Ouvrez Supabase > SQL Editor
2. Exécutez `init-db/22-create-supabase-schema.sql`
3. Relancez la migration

## ❌ Erreur : "duplicate key value"

**C'est normal** : Le script gère automatiquement les doublons. Si vous voyez cette erreur, le script essaiera d'insérer les enregistrements un par un.

## ❌ Erreur : "foreign key constraint"

**Solution** : Les tables sont migrées dans l'ordre des dépendances. Si vous avez cette erreur :

1. Vérifiez que toutes les tables sont dans `TABLES_TO_MIGRATE`
2. Vérifiez l'ordre des tables (les tables sans foreign keys en premier)

## 📊 Vérifier la progression

Le script affiche :
- `📦 Migrating table: [nom]` : Début de migration d'une table
- `📊 Found X records` : Nombre d'enregistrements trouvés
- `✅ Successfully migrated X records` : Migration réussie
- `⚠️ Some records already exist` : Certains enregistrements existent déjà (normal)

## 🆘 Aide supplémentaire

Si le problème persiste :
1. Vérifiez les logs complets dans la console
2. Vérifiez que les deux bases de données sont accessibles
3. Vérifiez que les tables existent dans Supabase








