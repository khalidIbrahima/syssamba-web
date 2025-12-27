# 🗄️ Configuration Supabase

SAMBA ONE utilise **Supabase** exclusivement pour toutes les opérations de base de données.

## 📋 Variables d'environnement

### Configuration Supabase

```env
# Option 1 : Utiliser DATABASE_URL (recommandé)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Option 2 : Utiliser SUPABASE_DB_URL (alternative)
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Pour les fonctionnalités Realtime (optionnel)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

## 🔧 Où trouver la connection string

1. Allez dans votre projet Supabase
2. **Settings** (⚙️) > **Database**
3. **Connection string** > **URI**
4. Copiez la connection string

## ⚙️ Configuration Avancée

### Pool de Connexions

Le client est configuré avec :
- **max**: 10 connexions simultanées
- **idle_timeout**: 20 secondes
- **prepare**: false (pour compatibilité avec les transactions)

## 🐛 Dépannage

### Erreur : "DATABASE_URL environment variable is not set"

**Solution** : Vérifiez que `DATABASE_URL` ou `SUPABASE_DB_URL` est défini dans `.env.local`

### Erreur de connexion

**Solutions** :
1. Vérifiez que le mot de passe est correct
2. Vérifiez que l'IP est autorisée dans Supabase (Settings > Database > Connection pooling)
3. Utilisez le connection string avec pooler : `aws-0-eu-central-1.pooler.supabase.com:6543`

### Erreur : "too many connections"

**Solutions** :
1. Réduisez le nombre de connexions dans `src/lib/db.ts` (max: 5)
2. Vérifiez qu'il n'y a pas de connexions qui ne se ferment pas

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
