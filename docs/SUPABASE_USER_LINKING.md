# Lien entre Supabase Auth et la table `users`

## Vue d'ensemble

Le lien entre l'utilisateur authentifié Supabase et la table `users` de l'application est fait via **l'ID Supabase** qui sert de **clé primaire** dans la table `users`.

## Architecture

```
Supabase Auth (auth.users)
    ↓
    user.id (UUID)
    ↓
Table users (id = user.id)
```

## Mécanisme de liaison

### 1. **Lors de l'inscription (Sign Up)**

**Fichier**: `src/app/api/auth/sign-up/route.ts`

```typescript
// 1. Supabase crée l'utilisateur dans auth.users
const { data, error } = await supabase.auth.signUp({
  email: email || phone || '',
  password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
    },
  },
});

// 2. L'ID Supabase (data.user.id) est utilisé comme ID dans users
const dbUser = await db.insertOne('users', {
  id: data.user.id,  // ← Lien direct : même UUID
  email: email || null,
  phone: phone || null,
  first_name: firstName,
  last_name: lastName,
  role: 'viewer',
  is_active: true,
  organization_id: null,
});
```

**Résultat**: Un enregistrement est créé dans `users` avec `id = data.user.id`

### 2. **Lors de la connexion (Sign In)**

**Fichier**: `src/app/api/auth/sign-in/route.ts`

```typescript
// 1. Supabase authentifie l'utilisateur
const { data, error } = await supabase.auth.signInWithPassword({
  email: email || phone || '',
  password,
});

// 2. Recherche dans users avec l'ID Supabase
let dbUser = await db.selectOne('users', {
  eq: { id: data.user.id },  // ← Recherche par ID Supabase
});

// 3. Si l'utilisateur n'existe pas, création automatique
if (!dbUser) {
  dbUser = await db.insertOne('users', {
    id: data.user.id,  // ← Même ID que Supabase
    // ... autres champs
  });
}
```

**Résultat**: L'utilisateur est trouvé ou créé avec `id = data.user.id`

### 3. **Lors de la récupération de l'utilisateur actuel**

**Fichier**: `src/lib/auth.ts`

```typescript
export async function getCurrentUser(): Promise<AuthUser | null> {
  // 1. Récupérer l'utilisateur Supabase
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // 2. Rechercher dans users avec l'ID Supabase
  const dbUser = await db.selectOne('users', {
    eq: { id: user.id },  // ← Lien direct via ID
  });

  // 3. Si l'utilisateur n'existe pas, création automatique
  if (!dbUser) {
    const newUser = await db.insertOne('users', {
      id: user.id,  // ← Même ID que Supabase
      // ... autres champs depuis user_metadata
    });
  }

  return dbUser;
}
```

**Résultat**: L'utilisateur est toujours synchronisé entre Supabase Auth et la table `users`

## Structure de la table `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- ← Même UUID que Supabase auth.users.id
    clerk_id TEXT UNIQUE,  -- ← Ancien ID Clerk (pour migration/rétrocompatibilité)
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    is_active BOOLEAN,
    organization_id UUID REFERENCES organizations(id),
    profile_id UUID REFERENCES profiles(id),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**: La colonne `clerk_id` existe encore pour la rétrocompatibilité avec les anciens utilisateurs créés via Clerk, mais les nouveaux utilisateurs utilisent uniquement `id` (Supabase UUID).

## Points importants

### ✅ Avantages de cette approche

1. **Simplicité**: Pas besoin de colonne séparée pour lier les deux tables
2. **Cohérence**: L'ID est unique et garanti par Supabase
3. **Performance**: Recherche directe par clé primaire (index automatique)
4. **Synchronisation automatique**: Si l'utilisateur existe dans Supabase mais pas dans `users`, il est créé automatiquement

### ⚠️ Points d'attention

1. **Pas de migration automatique**: Si vous migrez depuis Clerk, vous devez mapper les IDs manuellement
2. **Dépendance à Supabase**: L'ID doit toujours correspondre à `auth.users.id`
3. **Création automatique**: Les utilisateurs sont créés automatiquement si absents (comportement par défaut)

## Flux complet

```
1. Utilisateur s'inscrit
   ↓
2. Supabase crée auth.users avec UUID
   ↓
3. Application crée users avec id = auth.users.id
   ↓
4. Utilisateur se connecte
   ↓
5. Supabase authentifie et retourne user.id
   ↓
6. Application cherche users WHERE id = user.id
   ↓
7. Si trouvé → retourne les données
   Si non trouvé → crée automatiquement
```

## Exemple concret

```typescript
// Supabase Auth
auth.users = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  ...
}

// Table users
users = {
  id: "550e8400-e29b-41d4-a716-446655440000",  // ← Même UUID
  email: "user@example.com",
  first_name: "John",
  last_name: "Doe",
  role: "viewer",
  organization_id: null,
  ...
}
```

## Migration depuis Clerk

### État actuel

La table `users` contient une colonne `clerk_id` pour les anciens utilisateurs créés via Clerk. Les nouveaux utilisateurs créés via Supabase utilisent directement `id = auth.users.id`.

### Gestion de la migration

Le code actuel gère la transition dans `src/app/api/auth/sign-in/route.ts` :

```typescript
// 1. Cherche d'abord par id (Supabase - nouveau système)
let dbUser = await db.selectOne('users', {
  eq: { id: data.user.id },
});

// 2. Si non trouvé, cherche par clerk_id (Clerk legacy)
if (!dbUser) {
  dbUser = await db.selectOne('users', {
    eq: { clerk_id: data.user.id },
  });
}

// 3. Si toujours non trouvé, crée un nouvel utilisateur
if (!dbUser) {
  dbUser = await db.insertOne('users', {
    id: data.user.id,  // Nouvel ID Supabase
    clerk_id: data.user.id,  // Garde pour rétrocompatibilité
    // ... autres champs
  });
}
```

### Migration complète (recommandée)

Pour migrer complètement depuis Clerk vers Supabase :

1. **Créer un script de migration** qui :
   - Récupère tous les utilisateurs avec `clerk_id` mais sans `id` correspondant
   - Crée un compte Supabase pour chaque utilisateur
   - Met à jour `id` avec le nouvel UUID Supabase
   - Garde `clerk_id` pour référence

2. **Mettre à jour les requêtes** pour toujours chercher par `id` en priorité

3. **Déprécier `clerk_id`** progressivement (marquer comme nullable, puis supprimer)

