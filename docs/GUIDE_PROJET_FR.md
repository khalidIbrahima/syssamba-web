# 📚 Guide du Projet SambaOne - Pour Débutants

## 🎯 Vue d'Ensemble

**SambaOne** est une application de gestion immobilière construite avec **Next.js** (framework React) et **Supabase** (base de données).

---

## 🏗️ Architecture du Projet

```
SambaOne/
├── src/
│   ├── app/                    # Routes et pages de l'application
│   │   ├── (auth)/            # Pages protégées (nécessitent connexion)
│   │   │   └── admin/         # Pages d'administration
│   │   │       └── plan-features/  # Gestion des fonctionnalités par plan
│   │   ├── api/               # Endpoints API (côté serveur)
│   │   │   └── admin/
│   │   │       └── plan-features/  # API pour les fonctionnalités
│   │   └── auth/              # Pages d'authentification (login, etc.)
│   ├── components/            # Composants réutilisables
│   │   └── ui/               # Composants d'interface (boutons, cartes, etc.)
│   ├── hooks/                # Hooks React personnalisés
│   ├── lib/                  # Bibliothèques et utilitaires
│   │   ├── db.ts            # Connexion base de données
│   │   └── security/        # Système de sécurité
│   └── scripts/             # Scripts utilitaires
└── docs/                    # Documentation
```

---

## 🔑 Concepts Clés de Next.js

### 1. **Pages et Routes**

Next.js utilise le **système de fichiers** pour créer les routes :

```
src/app/admin/plan-features/page.tsx 
→ URL: /admin/plan-features
```

- `page.tsx` = une page visible dans le navigateur
- Le chemin du fichier = l'URL de la page

### 2. **Routes API**

Les fichiers `route.ts` créent des endpoints API :

```
src/app/api/admin/plan-features/route.ts
→ API: GET /api/admin/plan-features
```

### 3. **Composants Client vs Serveur**

- **'use client'** en haut du fichier = composant côté navigateur (peut utiliser useState, onClick, etc.)
- **Sans 'use client'** = composant côté serveur (plus rapide, bon pour le SEO)

---

## 📊 Base de Données - Structure

### Tables Principales

#### **1. `plans`** - Plans d'abonnement
```sql
plans
├── id (UUID)              -- Identifiant unique
├── name (text)            -- Nom technique (freemium, starter, etc.)
├── display_name (text)    -- Nom affiché (Freemium Plan, etc.)
├── description (text)     -- Description du plan
└── is_active (boolean)    -- Plan actif ou non
```

#### **2. `features`** - Fonctionnalités disponibles
```sql
features
├── id (UUID)              -- Identifiant unique
├── name (text)            -- Nom technique (property_management, etc.)
├── display_name (text)    -- Nom affiché (Property Management, etc.)
├── description (text)     -- Description de la fonctionnalité
├── category (text)        -- Catégorie (Core Features, Financial, etc.)
└── is_active (boolean)    -- Fonctionnalité active ou non
```

#### **3. `plan_features`** - Relations Plan ↔ Fonctionnalité
```sql
plan_features
├── id (UUID)              -- Identifiant unique
├── plan_id (UUID)         -- Référence vers plans.id
├── feature_id (UUID)      -- Référence vers features.id
├── is_enabled (boolean)   -- Fonctionnalité activée pour ce plan ?
├── limits (JSONB)         -- Limites (ex: max_properties: 5)
└── created_at (timestamp) -- Date de création
```

### Relations

```
Plan "Freemium"  ←→  plan_features  ←→  Feature "Property Management"
       ↓                   ↓                        ↓
    plan_id           is_enabled              feature_id
                     (true/false)
```

---

## 🔄 Flux de Données

### Comment la Page Admin Affiche les Données

```
1. Navigateur                    → GET /admin/plan-features
2. Page (page.tsx)               → Appelle API via useDataQuery()
3. API (route.ts)                → Query Supabase
4. Supabase (Database)           → Retourne les données
5. API transforme les données    → Format JSON
6. Page reçoit les données       → Affiche dans l'interface
```

### Code Simplifié

**Page (Frontend):**
```typescript
// src/app/(auth)/admin/plan-features/page.tsx

export default function PlanFeaturesPage() {
  // Récupère les données depuis l'API
  const { data, isLoading, error } = useDataQuery(
    ['plan-features-admin'], 
    getPlanFeatures
  );
  
  // Affiche un loader pendant le chargement
  if (isLoading) return <Loader />;
  
  // Affiche les données
  return <Table data={data} />;
}
```

**API (Backend):**
```typescript
// src/app/api/admin/plan-features/route.ts

export async function GET() {
  // 1. Récupère plan_features
  const pfData = await supabase
    .from('plan_features')
    .select('*');
  
  // 2. Récupère les plans
  const plans = await supabase
    .from('plans')
    .select('*');
  
  // 3. Récupère les features
  const features = await supabase
    .from('features')
    .select('*');
  
  // 4. Combine les données
  const combined = combineData(pfData, plans, features);
  
  // 5. Retourne en JSON
  return NextResponse.json({ plans: combined });
}
```

---

## 🔐 Système de Sécurité

### Niveaux de Sécurité

1. **Authentification** - L'utilisateur est-il connecté ?
2. **Autorisation** - Est-il super-admin ?
3. **Plan Features** - Son plan autorise-t-il cette fonctionnalité ?
4. **RLS (Row Level Security)** - Peut-il accéder à ces données ?

### Exemple de Vérification

```typescript
// Dans l'API
const { userId } = await checkAuth();          // 1. Est-il connecté ?
if (!userId) return error(401);

const isSuperAdmin = await isSuperAdmin(userId); // 2. Est-il admin ?
if (!isSuperAdmin) return error(403);

// Maintenant on peut accéder aux données
```

---

## 🎨 Interface Utilisateur

### Structure d'une Page

```typescript
export default function MaPage() {
  return (
    <div>
      {/* En-tête */}
      <h1>Gestion des Fonctionnalités</h1>
      
      {/* Statistiques */}
      <StatsCards data={stats} />
      
      {/* Onglets */}
      <Tabs>
        <Tab value="matrix">Vue Matrice</Tab>
        <Tab value="list">Vue Liste</Tab>
      </Tabs>
      
      {/* Contenu */}
      <Table data={data} />
    </div>
  );
}
```

### Composants Utilisés

- **Card** - Carte avec bordure
- **Button** - Bouton cliquable
- **Switch** - Interrupteur ON/OFF
- **Table** - Tableau de données
- **Badge** - Petit badge coloré
- **Tabs** - Onglets de navigation

---

## 🔧 Outils et Technologies

### Stack Technique

| Technologie | Rôle | Exemple |
|-------------|------|---------|
| **Next.js** | Framework web | Structure de l'app |
| **React** | Bibliothèque UI | Composants interactifs |
| **TypeScript** | Langage | Code typé et sécurisé |
| **Supabase** | Base de données | Stockage des données |
| **TanStack Query** | Cache de données | Gestion du state serveur |
| **Tailwind CSS** | Styles | Design de l'interface |
| **Shadcn/ui** | Composants UI | Boutons, cartes, etc. |

### Commandes Essentielles

```bash
# Démarrer le serveur de développement
npm run dev

# Compiler pour la production
npm run build

# Lancer un script
npx tsx src/scripts/mon-script.ts

# Installer une dépendance
npm install nom-du-package
```

---

## 📝 Fichiers Importants

### Configuration

- **`.env.local`** - Variables d'environnement (clés API, etc.)
- **`package.json`** - Dépendances et scripts
- **`tsconfig.json`** - Configuration TypeScript
- **`next.config.js`** - Configuration Next.js

### Code Principal

- **`src/app/layout.tsx`** - Layout principal de l'app
- **`src/lib/db.ts`** - Connexion à la base de données
- **`src/lib/auth-helpers.ts`** - Helpers d'authentification

---

## 🚀 Comment Ajouter une Nouvelle Fonctionnalité

### Exemple : Ajouter une page "Utilisateurs"

**1. Créer la page**
```typescript
// src/app/(auth)/admin/users/page.tsx
'use client';

export default function UsersPage() {
  return <div>Liste des utilisateurs</div>;
}
```

**2. Créer l'API**
```typescript
// src/app/api/admin/users/route.ts
export async function GET() {
  const users = await supabase.from('users').select('*');
  return NextResponse.json({ users });
}
```

**3. Ajouter dans le menu**
```typescript
// src/components/layout/sidebar.tsx
const navigation = [
  // ...
  { name: 'Utilisateurs', href: '/admin/users', icon: Users }
];
```

---

## 🐛 Résolution de Problèmes

### Problème : "Page ne charge pas"
✅ Vérifiez la console du navigateur (F12)
✅ Vérifiez les logs du serveur (terminal)

### Problème : "Erreur 401 Unauthorized"
✅ Vérifiez que vous êtes connecté
✅ Vérifiez les cookies de session

### Problème : "Erreur 403 Forbidden"
✅ Vérifiez vos permissions (super-admin ?)
✅ Vérifiez la configuration RLS dans Supabase

### Problème : "Données vides"
✅ Vérifiez que les tables ont des données
✅ Vérifiez les permissions RLS
✅ Utilisez la clé service_role pour les scripts

---

## 📖 Ressources pour Apprendre

### Documentation Officielle
- **Next.js** - https://nextjs.org/docs
- **React** - https://react.dev
- **Supabase** - https://supabase.com/docs
- **TypeScript** - https://www.typescriptlang.org/docs

### Tutoriels Recommandés
1. Next.js App Router Tutorial
2. React Hooks Guide
3. Supabase Quickstart
4. TypeScript for Beginners

---

## 💡 Bonnes Pratiques

### Organisation du Code

✅ **Un fichier = Une responsabilité**
✅ **Noms clairs et descriptifs**
✅ **Commentaires pour le code complexe**
✅ **Types TypeScript partout**

### Performance

✅ **Utilisez 'use server' quand possible**
✅ **Mise en cache avec TanStack Query**
✅ **Optimisez les images avec Next/Image**
✅ **Lazy loading pour les composants lourds**

### Sécurité

✅ **Jamais de clés API côté client**
✅ **Toujours valider les entrées utilisateur**
✅ **Utiliser les middleware pour l'auth**
✅ **RLS activé sur toutes les tables**

---

## 🎓 Exemple Complet

### Cas d'Usage : Activer/Désactiver une Fonctionnalité

**1. L'admin clique sur un switch dans l'interface**
```typescript
<Switch 
  checked={feature.isEnabled}
  onCheckedChange={() => toggleFeature(planId, featureId)}
/>
```

**2. Le frontend appelle l'API**
```typescript
async function toggleFeature(planId, featureId) {
  await fetch('/api/admin/plan-features', {
    method: 'POST',
    body: JSON.stringify({ planId, featureId, isEnabled: !current })
  });
}
```

**3. L'API met à jour la base de données**
```typescript
export async function POST(request) {
  const { planId, featureId, isEnabled } = await request.json();
  
  await supabase
    .from('plan_features')
    .update({ is_enabled: isEnabled })
    .eq('plan_id', planId)
    .eq('feature_id', featureId);
  
  return NextResponse.json({ success: true });
}
```

**4. L'interface se met à jour automatiquement**
```typescript
// TanStack Query refetch automatiquement
const { refetch } = useDataQuery(['plan-features'], getPlanFeatures);
```

---

## 🎯 Résumé pour les Débutants

### Ce Qu'il Faut Retenir

1. **Next.js = React + Routing + API**
   - Les fichiers dans `app/` deviennent des pages
   - Les fichiers `route.ts` deviennent des APIs

2. **Supabase = Base de données PostgreSQL**
   - Stocke les données dans des tables
   - Gère l'authentification et les permissions

3. **TypeScript = JavaScript avec des types**
   - Détecte les erreurs avant l'exécution
   - Meilleure autocomplétion

4. **Components = Blocs réutilisables**
   - Comme des LEGO pour construire l'interface
   - Props = paramètres d'entrée

5. **State = Données qui changent**
   - `useState` = state local (dans un composant)
   - `TanStack Query` = state serveur (données API)

---

## 📞 Besoin d'Aide ?

- 📖 Consultez la documentation dans `/docs`
- 💬 Demandez à l'équipe de développement
- 🐛 Créez une issue sur GitHub
- 📧 Contactez le support technique

---

**Bon courage dans votre apprentissage ! 🚀**

