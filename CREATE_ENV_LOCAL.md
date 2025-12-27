# 📝 Créer le fichier .env.local

Si le script ne trouve pas vos variables d'environnement, créez le fichier `.env.local` :

## 📍 Emplacement

Le fichier `.env.local` doit être à la **racine du projet** (même niveau que `package.json`).

## 📋 Contenu

Créez un fichier `.env.local` avec ce contenu :

```env
# Source : votre base PostgreSQL locale
SOURCE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/samba_one

# Target : votre Supabase
TARGET_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

## 🔧 Remplacez les valeurs

- `postgres:postgres` → votre `utilisateur:mot_de_passe` PostgreSQL
- `localhost:5432` → votre `hôte:port` si différent
- `samba_one` → le nom de votre base de données
- `[PASSWORD]` → votre mot de passe Supabase
- `xxxxx` → votre ID de projet Supabase

## ✅ Vérification

Après avoir créé le fichier, exécutez :

```powershell
npm run migrate:to-supabase
```

Le script devrait maintenant afficher :
```
📄 Loading .env.local...
✅ .env.local loaded successfully
🔍 Checking environment variables...
   SOURCE_DATABASE_URL: ✅ Set
   TARGET_DATABASE_URL: ✅ Set
```

## ⚠️ Important

- Le fichier `.env.local` est généralement ignoré par Git (dans `.gitignore`)
- Ne commitez jamais ce fichier avec des mots de passe réels
- Utilisez des variables d'environnement système pour la production







