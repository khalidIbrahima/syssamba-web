# Configuration Email

Ce document explique comment configurer l'envoi d'emails dans SambaOne.

## 📧 Providers supportés

Le système d'email supporte plusieurs providers :

1. **Resend** (recommandé pour la production)
2. **SMTP** (tout serveur SMTP)
3. **Console logging** (fallback en développement)

## 🔧 Configuration

### Option 1: Resend (Recommandé)

Resend est un service d'email moderne et fiable, idéal pour la production.

1. **Créer un compte** sur [resend.com](https://resend.com)
2. **Obtenir votre API key**
3. **Installer le package** (si pas déjà installé) :
   ```bash
   npm install resend
   ```
4. **Configurer la variable d'environnement** :
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=noreply@votre-domaine.com
   ```

### Option 2: SMTP

Pour utiliser un serveur SMTP (Gmail, SendGrid, Mailgun, etc.) :

1. **Installer le package** :
   ```bash
   npm install nodemailer
   ```
2. **Configurer les variables d'environnement** :
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=votre-email@gmail.com
   SMTP_PASSWORD=votre-mot-de-passe-app
   EMAIL_FROM=noreply@votre-domaine.com
   ```

**Note pour Gmail** : Vous devez utiliser un "App Password" au lieu de votre mot de passe normal. Activez la validation en 2 étapes et créez un mot de passe d'application.

### Option 3: Console (Développement)

En développement, si aucune configuration n'est fournie, les emails seront simplement loggés dans la console. Aucune configuration nécessaire.

## 📝 Variables d'environnement

| Variable | Description | Requis | Exemple |
|----------|-------------|--------|---------|
| `RESEND_API_KEY` | Clé API Resend | Si Resend | `re_xxxxxxxxxxxxx` |
| `SMTP_HOST` | Serveur SMTP | Si SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | Si SMTP | `587` |
| `SMTP_SECURE` | SSL/TLS | Si SMTP | `false` |
| `SMTP_USER` | Utilisateur SMTP | Si SMTP | `user@example.com` |
| `SMTP_PASSWORD` | Mot de passe SMTP | Si SMTP | `password` |
| `EMAIL_FROM` | Adresse email expéditeur | Optionnel | `noreply@sambaone.com` |
| `NEXT_PUBLIC_APP_URL` | URL de l'application | Optionnel | `https://app.sambaone.com` |

## 🚀 Utilisation

Le service d'email est automatiquement utilisé par :

- **Batch de mise à jour des souscriptions** : Envoie des emails aux admins lorsque leur abonnement expire
- **Autres notifications** : Peut être utilisé pour d'autres notifications dans l'application

### Exemple d'utilisation dans le code

```typescript
import { sendEmail, generateSubscriptionExpiredEmail } from '@/lib/email';

// Générer le contenu de l'email
const emailContent = generateSubscriptionExpiredEmail({
  organizationName: 'Mon Organisation',
  planName: 'Plan Pro',
  expirationDate: '15 janvier 2024',
  status: 'expired',
});

// Envoyer l'email
const result = await sendEmail({
  to: 'admin@example.com',
  subject: emailContent.subject,
  html: emailContent.html,
  text: emailContent.text,
});
```

## 📨 Emails automatiques

### Notification d'expiration d'abonnement

Lorsqu'une souscription expire (5 jours après la fin de la période), un email est automatiquement envoyé à tous les admins de l'organisation concernée.

**Destinataires** : Tous les utilisateurs avec le rôle `owner` ou `admin` de l'organisation

**Contenu** :
- Nom de l'organisation
- Plan concerné
- Date d'expiration
- Statut (expiré ou annulé)
- Lien vers la page de gestion des abonnements

## 🔍 Test

Pour tester la configuration email :

1. **Vérifier les variables d'environnement** :
   ```bash
   echo $RESEND_API_KEY  # ou $SMTP_HOST, etc.
   ```

2. **Exécuter le script de test** (à créer si nécessaire) :
   ```bash
   npx tsx scripts/test-email.ts
   ```

3. **Vérifier les logs** : Les emails envoyés avec succès ou les erreurs seront loggés dans la console.

## ⚠️ Dépannage

### Erreur "No email provider configured"

**Cause** : Aucune configuration email trouvée.

**Solution** : Configurez au moins un provider (Resend ou SMTP) avec les variables d'environnement appropriées.

### Erreur d'authentification SMTP

**Cause** : Identifiants SMTP incorrects.

**Solution** : 
- Vérifiez vos identifiants
- Pour Gmail, utilisez un "App Password"
- Vérifiez que le port et le serveur sont corrects

### Emails non reçus

**Vérifications** :
1. Vérifiez les logs pour voir si l'email a été envoyé
2. Vérifiez le dossier spam
3. Vérifiez que l'adresse email du destinataire est valide
4. Pour Resend, vérifiez le dashboard pour voir le statut de l'email

## 📚 Ressources

- [Documentation Resend](https://resend.com/docs)
- [Documentation Nodemailer](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)




