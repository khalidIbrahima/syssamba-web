# Analyse : feature_key vs feature_id dans plan_features

## Comparaison des deux approches

### 1. **feature_key (TEXT) référençant features(key)** ✅ **RECOMMANDÉ**

#### Avantages :
- ✅ **Lisibilité** : On voit directement `"task_management"` au lieu d'un UUID
- ✅ **Débogage facile** : Les requêtes SQL sont plus compréhensibles
- ✅ **Pas de jointure nécessaire** : On sait directement quelle fonctionnalité c'est
- ✅ **Clés stables** : Les clés de fonctionnalités ne changent presque jamais
- ✅ **Contrainte de clé étrangère valide** : PostgreSQL supporte `REFERENCES features(key)`
- ✅ **Index performant** : Index sur TEXT est aussi rapide que sur UUID pour ce cas d'usage
- ✅ **Cohérence avec le code** : Le code utilise déjà les clés (`"task_management"`)

#### Inconvénients :
- ❌ **Jointures Supabase automatiques** : Ne fonctionnent pas directement (mais on peut faire manuellement)
- ❌ **Légèrement plus d'espace** : TEXT prend un peu plus d'espace que UUID (négligeable)

#### Exemple de requête :
```sql
-- Direct et lisible
SELECT * FROM plan_features WHERE feature_key = 'task_management';
```

---

### 2. **feature_id (UUID) référençant features(id)**

#### Avantages :
- ✅ **Jointures Supabase automatiques** : Fonctionnent avec `features!inner`
- ✅ **Relation "normale"** : Standard en base de données relationnelle
- ✅ **Performance** : Légèrement plus rapide pour les jointures (UUID indexé)
- ✅ **Stabilité** : Si la clé change, l'ID reste stable

#### Inconvénients :
- ❌ **Moins lisible** : On voit `a1b2c3d4-e5f6-7890-abcd-ef1234567890` au lieu de `"task_management"`
- ❌ **Débogage difficile** : Besoin de jointure pour savoir quelle fonctionnalité c'est
- ❌ **Requête supplémentaire** : Toujours besoin de chercher le feature_id avant d'insérer
- ❌ **Incohérence** : Le code utilise des clés (`"task_management"`), pas des IDs

#### Exemple de requête :
```sql
-- Moins lisible, besoin de jointure
SELECT pf.*, f.key 
FROM plan_features pf
JOIN features f ON pf.feature_id = f.id
WHERE f.key = 'task_management';
```

---

## Recommandation : **feature_key (TEXT)** ✅

### Pourquoi ?

1. **Cohérence avec le code** : Votre code utilise déjà les clés de fonctionnalités (`"task_management"`, `"property_management"`, etc.)

2. **Lisibilité et maintenabilité** : 
   ```sql
   -- Avec feature_key : Direct et clair
   SELECT * FROM plan_features WHERE feature_key = 'task_management';
   
   -- Avec feature_id : Besoin de jointure
   SELECT pf.* FROM plan_features pf 
   JOIN features f ON pf.feature_id = f.id 
   WHERE f.key = 'task_management';
   ```

3. **Débogage facilité** : Quand vous regardez la table `plan_features`, vous voyez directement les noms des fonctionnalités

4. **Performance suffisante** : Avec un index sur `feature_key`, les performances sont excellentes

5. **Contrainte de clé étrangère** : PostgreSQL supporte parfaitement `REFERENCES features(key)`

6. **Stabilité** : Les clés de fonctionnalités sont stables et ne changent pas (contrairement aux noms d'affichage)

### Structure actuelle (correcte) :

```sql
CREATE TABLE plan_features (
    id UUID PRIMARY KEY,
    plan_id UUID REFERENCES plans(id),
    feature_key TEXT NOT NULL REFERENCES features(key) ON DELETE CASCADE,  -- ✅ Correct
    is_enabled BOOLEAN DEFAULT true,
    UNIQUE(plan_id, feature_key)
);

CREATE INDEX idx_plan_features_feature ON plan_features(feature_key);  -- ✅ Index pour performance
```

### Code API (corrigé) :

```typescript
// ✅ Correct : Utilise feature_key directement
const planFeatures = await db.select('plan_features', {
  eq: { plan_id: plan.id },
});

const featureKeys = planFeatures.map(pf => pf.feature_key);
const features = await db.select('features', {
  in: { key: featureKeys },
});
```

---

## Conclusion

**Utilisez `feature_key (TEXT) référençant features(key)`** - C'est la solution la plus sûre et la plus maintenable pour votre cas d'usage.

La seule limitation (jointures Supabase automatiques) est facilement contournée avec une requête manuelle en deux étapes, ce qui est plus clair et plus lisible de toute façon.

