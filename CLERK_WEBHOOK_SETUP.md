# Configuration des Webhooks Clerk

Ce guide explique comment configurer les webhooks Clerk pour synchroniser automatiquement les utilisateurs avec la base de données.

## 📋 Prérequis

- Compte Clerk configuré
- Application Next.js déployée ou accessible via tunnel (ngrok, etc.)
- Variable d'environnement `CLERK_WEBHOOK_SECRET` configurée

## 🔧 Configuration

### 1. Obtenir le Webhook Secret

1. Connectez-vous à votre [Dashboard Clerk](https://dashboard.clerk.com)
2. Sélectionnez votre application
3. Allez dans **Webhooks** dans le menu de gauche
4. Cliquez sur **Add Endpoint**
5. Configurez l'endpoint :
   - **URL** : `https://votre-domaine.com/api/webhooks/clerk`
   - **Events** : Sélectionnez les événements suivants :
     - `user.created`
     - `user.updated`
     - `user.deleted`
6. Cliquez sur **Create**
7. Copiez le **Signing Secret** (commence par `whsec_`)

### 2. Configurer la Variable d'Environnement

Ajoutez le secret dans votre fichier `.env.local` :

```env
CLERK_WEBHOOK_SECRET=whsec_votre_secret_ici
```

### 3. Pour le Développement Local

Si vous testez en local, utilisez un tunnel comme [ngrok](https://ngrok.com) :

```bash
# Installer ngrok
npm install -g ngrok

# Démarrer votre serveur Next.js
npm run dev

# Dans un autre terminal, créer un tunnel
ngrok http 3000

# Utiliser l'URL fournie par ngrok dans Clerk Dashboard
# Exemple: https://abc123.ngrok.io/api/webhooks/clerk
```

## 🔄 Synchronisation Automatique

Le système synchronise automatiquement les utilisateurs de deux façons :

### 1. Via Webhooks (Recommandé)

Les webhooks Clerk déclenchent automatiquement la synchronisation lors de :
- **Création d'utilisateur** : Crée un nouvel utilisateur dans la base de données
- **Mise à jour d'utilisateur** : Met à jour les informations (email, nom, avatar, etc.)
- **Suppression d'utilisateur** : Supprime complètement l'utilisateur de la base de données (hard delete)

### 2. Via Layout Authentifié (Fallback)

Si un utilisateur se connecte et n'existe pas encore dans la base de données, il sera automatiquement créé lors de sa première visite sur une page protégée.

## 📊 Structure des Données Synchronisées

Les données suivantes sont synchronisées depuis Clerk :

- `clerkId` : ID unique de l'utilisateur Clerk
- `email` : Email principal
- `phone` : Téléphone principal
- `firstName` : Prénom
- `lastName` : Nom
- `avatarUrl` : URL de l'avatar
- `isActive` : Statut actif (false si supprimé)

## 🧪 Tester la Synchronisation

1. Créez un nouvel utilisateur via Clerk (sign-up)
2. Vérifiez dans votre base de données que l'utilisateur a été créé :
   ```sql
   SELECT * FROM users WHERE clerk_id = 'user_xxx';
   ```
3. Modifiez le profil de l'utilisateur dans Clerk
4. Vérifiez que les changements sont reflétés dans la base de données

## 🐛 Dépannage

### Webhook non reçu

- Vérifiez que l'URL du webhook est correcte et accessible
- Vérifiez les logs dans Clerk Dashboard > Webhooks > Logs
- Vérifiez que `CLERK_WEBHOOK_SECRET` est correctement configuré

### Erreur de vérification

- Assurez-vous que le secret correspond à celui dans Clerk Dashboard
- Vérifiez que les headers Svix sont présents dans la requête

### Utilisateur non créé

- Vérifiez les logs du serveur pour les erreurs
- Vérifiez que la base de données est accessible
- Vérifiez que les migrations Drizzle ont été appliquées

## 📝 Notes

- Les utilisateurs supprimés dans Clerk sont **complètement supprimés** de la base de données (hard delete)
- ⚠️ **Attention** : La suppression est définitive. Les données associées à l'utilisateur (via `onDelete: 'cascade'`) seront également supprimées selon les contraintes de la base de données
- Le rôle par défaut est `viewer` - vous pouvez le modifier manuellement dans la base de données
- La synchronisation via layout est un fallback et peut être désactivée si vous préférez uniquement les webhooks

