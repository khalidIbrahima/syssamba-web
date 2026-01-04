# Comment ajouter une nouvelle fonctionnalité dans FeatureGate

Ce guide explique comment créer une nouvelle fonctionnalité et l'intégrer dans le système `FeatureGate`.

## Étapes pour ajouter une fonctionnalité

### 1. Créer la fonctionnalité dans la base de données

Créez un script SQL dans le dossier `init-db/` (par exemple `65-add-task-management-feature.sql`) :

```sql
-- Ajouter la fonctionnalité dans la table features
INSERT INTO features (key, name, description, category, icon) VALUES
('task_management', 'Gestion des tâches', 'Système complet de gestion des tâches', 'tasks', 'CheckSquare')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    updated_at = NOW();

-- Activer la fonctionnalité pour les plans appropriés
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT id, 'task_management', true
FROM plans
WHERE name IN ('starter', 'pro', 'agency', 'enterprise')
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    is_enabled = true,
    updated_at = NOW();
```

**Important :**
- `key` : C'est la clé utilisée dans `FeatureGate` (ex: `"task_management"`)
- `name` : Nom d'affichage de la fonctionnalité
- `category` : Catégorie (ex: 'tasks', 'core', 'payments', etc.)
- `icon` : Nom de l'icône Lucide React

### 2. Exécuter le script SQL

Exécutez le script SQL dans votre base de données Supabase :

```bash
# Via Supabase CLI
supabase db execute -f init-db/65-add-task-management-feature.sql

# Ou via l'interface Supabase Dashboard
# Copiez-collez le contenu du script dans l'éditeur SQL
```

### 3. Utiliser FeatureGate dans votre code

Une fois la fonctionnalité créée et liée aux plans, vous pouvez l'utiliser avec `FeatureGate` :

```tsx
import { FeatureGate } from '@/components/features/FeatureGate';

export default function MyPage() {
  return (
    <FeatureGate feature="task_management" showUpgrade={true}>
      <div>
        {/* Votre contenu ici */}
        <h1>Gestion des tâches</h1>
      </div>
    </FeatureGate>
  );
}
```

**Paramètres de FeatureGate :**
- `feature` : La clé de la fonctionnalité (ex: `"task_management"`)
- `showUpgrade` : Affiche un message de mise à niveau si la fonctionnalité n'est pas disponible
- `fallback` : Contenu alternatif à afficher si la fonctionnalité n'est pas disponible

### 4. Vérifier que la fonctionnalité fonctionne

1. **Vérifier dans la base de données :**
   ```sql
   -- Vérifier que la fonctionnalité existe
   SELECT * FROM features WHERE key = 'task_management';
   
   -- Vérifier qu'elle est liée aux plans
   SELECT p.name, pf.is_enabled 
   FROM plan_features pf
   JOIN plans p ON pf.plan_id = p.id
   WHERE pf.feature_key = 'task_management';
   ```

2. **Tester dans l'application :**
   - Connectez-vous avec un utilisateur ayant un plan qui inclut la fonctionnalité
   - Vérifiez que le contenu dans `FeatureGate` s'affiche
   - Testez avec un plan qui n'inclut pas la fonctionnalité pour voir le message de mise à niveau

## Exemple complet : task_management

Le script `init-db/65-add-task-management-feature.sql` ajoute la fonctionnalité `task_management` et l'active pour les plans `starter`, `pro`, `agency`, et `enterprise`.

**Utilisation :**

```tsx
import { FeatureGate } from '@/components/features/FeatureGate';

export default function TasksPage() {
  return (
    <FeatureGate feature="task_management" showUpgrade={true}>
      <div>
        <h1>Gestion des Tâches</h1>
        {/* Votre contenu de gestion des tâches */}
      </div>
    </FeatureGate>
  );
}
```

## Notes importantes

1. **La clé de la fonctionnalité** (`key` dans la table `features`) doit correspondre exactement à la valeur passée à `FeatureGate` :
   ```tsx
   <FeatureGate feature="task_management" /> // ✅ Correct
   <FeatureGate feature="task-management" /> // ❌ Incorrect (ne correspond pas)
   ```

2. **Le FeatureContext** récupère automatiquement les fonctionnalités de l'utilisateur via l'API `/api/user/plan-features`

3. **Les fonctionnalités sont mises en cache** pendant 5 minutes pour améliorer les performances

4. **Pour activer/désactiver une fonctionnalité pour un plan**, utilisez l'interface d'administration `/admin/plan-features`

## Dépannage

Si `FeatureGate` ne fonctionne pas :

1. Vérifiez que la fonctionnalité existe dans la table `features` avec la bonne clé
2. Vérifiez que `plan_features` contient une entrée pour votre plan et votre fonctionnalité
3. Vérifiez que `is_enabled = true` dans `plan_features`
4. Vérifiez les logs de l'API `/api/user/plan-features` dans la console du navigateur
5. Videz le cache du navigateur et rechargez la page

