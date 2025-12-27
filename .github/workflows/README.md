# GitHub Actions - Déploiement Netlify

## Configuration Requise

### 1. Secrets GitHub

Ajoutez ces secrets dans votre repository GitHub (Settings → Secrets and variables → Actions) :

#### `NETLIFY_SITE_ID`
- **Comment l'obtenir** :
  1. Allez dans votre [dashboard Netlify](https://app.netlify.com)
  2. Sélectionnez votre site
  3. Allez dans "Site settings" → "General" → "Site details"
  4. Copiez le "Site ID"

#### `NETLIFY_AUTH_TOKEN`
- **Comment l'obtenir** :
  1. Allez dans [User Settings](https://app.netlify.com/user/settings)
  2. "Applications" → "Personal access tokens"
  3. "New access token"
  4. Nommez-le (ex: "GitHub Actions")
  5. Copiez le token généré

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
4. **Build** : Construction avec `npm run build:netlify`
5. **Deploy** :
   - Production : `--prod` flag (site live)
   - Preview : Déploiement temporaire

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

#### "Netlify CLI not found"
- Le workflow utilise `netlify/actions/cli@master`
- Assurez-vous que les secrets sont correctement configurés

#### "Build failed"
- Vérifiez les logs du workflow GitHub Actions
- Testez le build localement : `npm run build:netlify`

#### "Environment variables missing"
- Vérifiez que les variables sont définies dans Netlify Dashboard
- Les variables du workflow sont fictives (pour le build seulement)

### Logs et Debugging

1. **GitHub Actions** : Onglet "Actions" du repository
2. **Netlify Dashboard** : Onglet "Deploys"
3. **Build logs** : Détails complets des erreurs

## Sécurité

- ✅ **Secrets chiffrés** : Clés API non exposées
- ✅ **Variables isolées** : Build vs Runtime
- ✅ **Permissions limitées** : Token d'accès personnel
- ✅ **Reviews required** : Pour les merges en production

## Optimisations

- **Cache npm** : Accélère les builds suivants
- **Node.js 18** : Version optimisée pour Next.js
- **Build optimisé** : Variables fictives pendant le build
- **Preview deployments** : Tests avant production
