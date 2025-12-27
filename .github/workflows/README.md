# GitHub Actions - Déploiement Netlify

## Configuration Requise

### 1. Build Hook Netlify

Le workflow utilise directement le build hook Netlify fourni. **Aucune configuration de secrets n'est requise !**

**Build Hook configuré :**
```
https://api.netlify.com/build_hooks/695046df1d20c7a607e6c990
```

### 2. Variables d'Environnement Netlify

Dans le dashboard Netlify, ajoutez ces variables d'environnement :

```
NEXT_PUBLIC_SUPABASE_URL=https://votre-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
NEXT_PUBLIC_APP_URL=https://votre-site.netlify.app
```

## Fonctionnement du Workflow

### Déclencheurs
- **Push sur master** : Déploiement en production
- **Pull Request** : Déploiement de preview

### Étapes
1. **Checkout** : Récupération du code
2. **Setup Node.js** : Installation de Node.js 18
3. **Dependencies** : Installation des dépendances npm
4. **Build** : Validation avec `npm run build:netlify`
5. **Trigger** : Déclenchement du build Netlify via webhook

## Utilisation

### Déploiement Automatique
1. **Push sur master** → Déploiement automatique en production
2. **Pull Request** → Création d'un déploiement de preview

### Déploiement Manuel
```bash
# Depuis une branche
git checkout -b feature/nouvelle-fonctionnalite
# Commits...
git push origin feature/nouvelle-fonctionnalite

# Créer une Pull Request
# → Déploiement de preview automatique
# → Merge vers master
# → Déploiement en production automatique
```

## Dépannage

### Erreurs Courantes

#### "Build hook failed"
- Vérifiez que le build hook URL est accessible
- Le workflow utilise le build hook directement (pas de secrets requis)

#### "Build failed"
- Vérifiez les logs du workflow GitHub Actions
- Testez le build localement : `npm run build:netlify`

#### "HTTP error from build hook"
- Code 200/201 = succès
- Autres codes = vérifiez la configuration Netlify

#### "Environment variables missing"
- Vérifiez que les variables sont définies dans Netlify Dashboard
- Les variables du workflow sont fictives (pour le build seulement)

### Logs et Debugging

1. **GitHub Actions** : Onglet "Actions" du repository
2. **Netlify Dashboard** : Onglet "Deploys"
3. **Build logs** : Détails complets des erreurs

## Sécurité

- ✅ **Pas de secrets** : Build hook publique
- ✅ **Variables isolées** : Build vs Runtime
- ✅ **Webhook sécurisé** : URL unique pour votre site
- ✅ **Reviews required** : Pour les merges en production

## Optimisations

- **Cache npm** : Accélère les builds suivants
- **Node.js 18** : Version optimisée pour Next.js
- **Validation locale** : Build testé avant déclenchement
- **Webhook rapide** : Déclenchement instantané
- **Preview deployments** : Tests avant production
