# Guide de Feature Gating (Contrôle des Fonctionnalités)

Ce guide explique comment utiliser le système de feature gating pour contrôler l'accès aux fonctionnalités en fonction du plan d'abonnement de l'utilisateur.

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation](#installation)
3. [Composants](#composants)
4. [Hooks](#hooks)
5. [Exemples d'utilisation](#exemples-dutilisation)
6. [Stratégies de mise en cache](#stratégies-de-mise-en-cache)

---

## Vue d'ensemble

Le système de feature gating permet de :
- ✅ Afficher/masquer des fonctionnalités selon le plan
- ✅ Limiter l'accès à certaines parties de l'interface
- ✅ Appliquer des limites (ex: max 10 propriétés)
- ✅ Afficher des messages d'upgrade
- ✅ Gérer le cache pour les performances

## Installation

### 1. Ajouter le Provider dans le Layout

```tsx
// src/app/(auth)/layout.tsx
import { FeatureProvider } from '@/contexts/FeatureContext';

export default function AuthLayout({ children }) {
  return (
    <FeatureProvider>
      {children}
    </FeatureProvider>
  );
}
```

### 2. Structure de la base de données

Le système utilise ces tables :
- `plans` - Les plans d'abonnement
- `features` - Les fonctionnalités disponibles
- `plan_features` - Relation entre plans et fonctionnalités
- `organizations` - Les organisations avec leur `plan_id`

---

## Composants

### 1. **FeatureGate** - Masquer/Afficher du contenu

Masque le contenu si la fonctionnalité n'est pas disponible.

```tsx
import { FeatureGate } from '@/components/features/FeatureGate';

// Simple - masque si non disponible
<FeatureGate feature="advanced_analytics">
  <AnalyticsDashboard />
</FeatureGate>

// Avec message d'upgrade
<FeatureGate feature="advanced_analytics" showUpgrade>
  <AnalyticsDashboard />
</FeatureGate>

// Avec fallback personnalisé
<FeatureGate 
  feature="advanced_analytics"
  fallback={<BasicAnalytics />}
>
  <AdvancedAnalytics />
</FeatureGate>
```

### 2. **FeatureToggle** - Afficher du contenu différent

Affiche un contenu différent selon l'état de la fonctionnalité.

```tsx
import { FeatureToggle } from '@/components/features/FeatureGate';

<FeatureToggle
  feature="advanced_reporting"
  enabled={<AdvancedReports />}
  disabled={<BasicReports />}
/>
```

### 3. **RequireFeature** - Plusieurs fonctionnalités

Requiert une ou plusieurs fonctionnalités.

```tsx
import { RequireFeature } from '@/components/features/FeatureGate';

// Requiert TOUTES les fonctionnalités
<RequireFeature 
  features={["advanced_analytics", "api_access"]} 
  requireAll
>
  <ApiAnalyticsDashboard />
</RequireFeature>

// Requiert AU MOINS UNE fonctionnalité
<RequireFeature 
  features={["email_notifications", "sms_notifications"]} 
  requireAll={false}
>
  <NotificationSettings />
</RequireFeature>
```

### 4. **FeatureLimit** - Accéder aux limites

Accède aux valeurs de limite d'une fonctionnalité.

```tsx
import { FeatureLimit } from '@/components/features/FeatureGate';

<FeatureLimit feature="property_management" limitKey="max_properties">
  {(maxProperties) => (
    <div>
      <p>Limite : {maxProperties} propriétés</p>
      <ProgressBar current={currentCount} max={maxProperties} />
    </div>
  )}
</FeatureLimit>
```

---

## Hooks

### 1. **useFeatures()** - Accès complet

Hook principal pour accéder à toutes les fonctionnalités.

```tsx
import { useFeatures } from '@/contexts/FeatureContext';

function MyComponent() {
  const { 
    plan,              // Infos du plan
    features,          // Liste des fonctionnalités
    hasFeature,        // Vérifie si la fonctionnalité existe
    isFeatureEnabled,  // Vérifie si activée
    getFeatureLimit,   // Récupère une limite
    isLoading,
    error
  } = useFeatures();

  if (isFeatureEnabled('advanced_analytics')) {
    return <AdvancedDashboard />;
  }
  
  return <BasicDashboard />;
}
```

### 2. **useFeature()** - Fonctionnalité spécifique

Hook simplifié pour une seule fonctionnalité.

```tsx
import { useFeature } from '@/contexts/FeatureContext';

function PropertyForm() {
  const { isEnabled, getLimit } = useFeature('property_management');
  
  const maxProperties = getLimit('max_properties');
  
  if (!isEnabled) {
    return <p>Cette fonctionnalité n'est pas disponible</p>;
  }
  
  return (
    <form>
      <p>Vous pouvez créer jusqu'à {maxProperties} propriétés</p>
    </form>
  );
}
```

### 3. **useFeatureCheck()** - Vérification simple

```tsx
import { useFeatureCheck } from '@/hooks/use-feature-check';

function AnalyticsButton() {
  const { canAccess } = useFeatureCheck('advanced_analytics');
  
  if (!canAccess) return null;
  
  return <Button>Voir les analytiques avancées</Button>;
}
```

### 4. **useFeatureLimit()** - Gestion des limites

```tsx
import { useFeatureLimit } from '@/hooks/use-feature-check';

function PropertyList() {
  const { limit, hasLimit } = useFeatureLimit('property_management', 'max_properties');
  
  const handleAddProperty = () => {
    if (hasLimit && properties.length >= limit) {
      toast.error(`Limite atteinte : ${limit} propriétés maximum`);
      return;
    }
    
    // Ajouter la propriété
  };
}
```

### 5. **useFeatureLimitCheck()** - Vérification automatique

```tsx
import { useFeatureLimitCheck } from '@/hooks/use-feature-check';

function PropertyManager() {
  const { canAdd, remaining, limit } = useFeatureLimitCheck(
    'property_management',
    'max_properties',
    currentPropertiesCount
  );
  
  return (
    <div>
      <p>Propriétés restantes : {remaining} / {limit}</p>
      <Button disabled={!canAdd}>
        Ajouter une propriété
      </Button>
    </div>
  );
}
```

---

## Exemples d'utilisation

### Exemple 1 : Bouton conditionnel dans la navigation

```tsx
// src/components/navigation/Sidebar.tsx
import { useFeatureCheck } from '@/hooks/use-feature-check';

function Sidebar() {
  const { canAccess: hasAnalytics } = useFeatureCheck('advanced_analytics');
  const { canAccess: hasReports } = useFeatureCheck('advanced_reporting');
  
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/properties">Propriétés</Link>
      
      {hasAnalytics && (
        <Link href="/analytics">Analytiques Avancées</Link>
      )}
      
      {hasReports && (
        <Link href="/reports">Rapports</Link>
      )}
    </nav>
  );
}
```

### Exemple 2 : Page complète avec feature gate

```tsx
// src/app/(auth)/analytics/page.tsx
import { FeatureGate } from '@/components/features/FeatureGate';

export default function AnalyticsPage() {
  return (
    <FeatureGate feature="advanced_analytics" showUpgrade>
      <div>
        <h1>Analytiques Avancées</h1>
        <AnalyticsDashboard />
      </div>
    </FeatureGate>
  );
}
```

### Exemple 3 : Formulaire avec limite

```tsx
// src/app/(auth)/properties/new/page.tsx
import { useFeatureLimitCheck } from '@/hooks/use-feature-check';
import { useQuery } from '@tanstack/react-query';

export default function NewPropertyPage() {
  // Compter les propriétés actuelles
  const { data: properties } = useQuery(['properties'], fetchProperties);
  const currentCount = properties?.length || 0;
  
  // Vérifier la limite
  const { canAdd, remaining, limit } = useFeatureLimitCheck(
    'property_management',
    'max_properties',
    currentCount
  );
  
  if (!canAdd) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Limite Atteinte</h2>
          <p>
            Vous avez atteint la limite de {limit} propriétés 
            pour votre plan actuel.
          </p>
          <Button className="mt-4">Mettre à niveau</Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Propriétés restantes : {remaining} / {limit}
      </p>
      <PropertyForm />
    </div>
  );
}
```

### Exemple 4 : Section d'une page

```tsx
// src/app/(auth)/dashboard/page.tsx
import { FeatureToggle } from '@/components/features/FeatureGate';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Toujours visible */}
      <BasicStats />
      
      {/* Conditionnel selon la fonctionnalité */}
      <FeatureToggle
        feature="advanced_analytics"
        enabled={<AdvancedCharts />}
        disabled={<BasicCharts />}
      />
      
      {/* Seulement si disponible */}
      <FeatureGate feature="financial_forecasting">
        <ForecastingWidget />
      </FeatureGate>
    </div>
  );
}
```

### Exemple 5 : Action avec vérification

```tsx
// src/components/PropertyActions.tsx
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { toast } from 'sonner';

function PropertyActions({ property }: { property: Property }) {
  const { canAccess: canExport } = useFeatureCheck('bulk_operations');
  const { canAccess: hasAPI } = useFeatureCheck('api_access');
  
  const handleExport = () => {
    if (!canExport) {
      toast.error('Cette fonctionnalité nécessite le plan Premium');
      return;
    }
    
    // Exporter...
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuItem>Modifier</DropdownMenuItem>
      <DropdownMenuItem>Supprimer</DropdownMenuItem>
      
      {canExport && (
        <DropdownMenuItem onClick={handleExport}>
          Exporter
        </DropdownMenuItem>
      )}
      
      {hasAPI && (
        <DropdownMenuItem>
          Voir dans l'API
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  );
}
```

---

## Stratégies de mise en cache

Le système utilise React Query pour le caching :

### Configuration actuelle
```typescript
{
  staleTime: 5 * 60 * 1000,  // 5 minutes - données considérées fraîches
  cacheTime: 10 * 60 * 1000, // 10 minutes - conservé en cache
}
```

### Forcer le rafraîchissement

```tsx
import { useQueryClient } from '@tanstack/react-query';

function AdminPanel() {
  const queryClient = useQueryClient();
  
  const handlePlanUpdate = async () => {
    // Mettre à jour le plan...
    
    // Forcer le rafraîchissement pour tous les utilisateurs
    await queryClient.invalidateQueries(['user-plan-features']);
  };
}
```

---

## 🎯 Bonnes Pratiques

1. **Utilisez FeatureGate pour les sections entières**
   ```tsx
   <FeatureGate feature="advanced_analytics" showUpgrade>
     <AnalyticsSection />
   </FeatureGate>
   ```

2. **Utilisez useFeatureCheck pour les petits éléments**
   ```tsx
   const { canAccess } = useFeatureCheck('feature');
   if (!canAccess) return null;
   ```

3. **Vérifiez les limites avant les actions**
   ```tsx
   const { canAdd } = useFeatureLimitCheck('feature', 'max', count);
   if (!canAdd) {
     toast.error('Limite atteinte');
     return;
   }
   ```

4. **Utilisez le cache intelligemment**
   - Mise en cache de 5-10 minutes pour réduire les appels API
   - Invalidation après les modifications de plan
   - Rafraîchissement automatique après upgrade

5. **Messages utilisateur clairs**
   - Expliquez pourquoi la fonctionnalité est verrouillée
   - Proposez un bouton d'upgrade
   - Montrez les alternatives disponibles

---

## 🔄 Workflow Admin → Utilisateur

```
1. Admin active/désactive une fonctionnalité dans /admin/plan-features
   ↓
2. La modification est enregistrée dans plan_features
   ↓
3. L'utilisateur rafraîchit ou le cache expire (5 min)
   ↓
4. L'API /api/user/plan-features retourne les nouvelles données
   ↓
5. Le FeatureContext met à jour
   ↓
6. Les composants FeatureGate se mettent à jour automatiquement
   ↓
7. L'UI reflète les nouveaux accès immédiatement
```

---

## 📞 Support

Pour toute question sur le feature gating :
- Consultez ce guide
- Vérifiez les exemples dans le code
- Testez avec différents plans dans /admin/plan-features

