# Batch Update des Souscriptions Expirées

Ce document explique comment utiliser les scripts de mise à jour automatique des souscriptions expirées.

## 📋 Vue d'ensemble

Les scripts mettent à jour automatiquement le statut des souscriptions qui ont dépassé leur période de validité depuis plus de 5 jours et envoient des emails de notification aux administrateurs des organisations concernées.

### Logique de détermination de la date d'expiration

1. **Si `cancel_at_period_end = true`** : Utilise `current_period_end` comme date d'expiration
2. **Si `end_date` existe** : Utilise `end_date` comme date d'expiration
3. **Sinon** : Utilise `current_period_end` comme date d'expiration

### Statut assigné

- **`canceled`** : Si l'abonnement était programmé pour être annulé (`cancel_at_period_end = true`) ou a déjà été annulé (`canceled_at` existe)
- **`expired`** : Sinon

### Notification par email

Après la mise à jour du statut, un email est automatiquement envoyé à tous les administrateurs de l'organisation concernée (rôles `owner` et `admin`). L'email contient :
- Le nom de l'organisation
- Le plan concerné
- La date d'expiration
- Le statut (expiré ou annulé)
- Un lien vers la page de gestion des abonnements

**Note** : Pour que les emails soient envoyés, vous devez configurer un provider d'email (Resend ou SMTP). Voir [Configuration Email](./EMAIL_CONFIGURATION.md) pour plus de détails.

## 🗄️ Option 1: Fonction PostgreSQL (Recommandé)

### Installation

Exécutez le script SQL pour créer la fonction:

```bash
psql -d votre_base_de_donnees -f init-db/79-update-expired-subscriptions-batch.sql
```

### Utilisation

#### Exécution manuelle

```sql
SELECT * FROM update_expired_subscriptions();
```

#### Configuration d'un cron job (pg_cron)

Si vous utilisez pg_cron (extension PostgreSQL):

```sql
-- Exécuter tous les jours à 2h du matin
SELECT cron.schedule(
    'update-expired-subscriptions',
    '0 2 * * *',
    $$SELECT * FROM update_expired_subscriptions();$$
);
```

#### Configuration d'un cron job système

Ajoutez à votre crontab (`crontab -e`):

```bash
# Exécuter tous les jours à 2h du matin
0 2 * * * psql -d votre_base_de_donnees -c "SELECT * FROM update_expired_subscriptions();"
```

## 📜 Option 2: Script TypeScript

### Exécution manuelle

```bash
npx tsx scripts/update-expired-subscriptions.ts
```

### Configuration d'un cron job

Ajoutez à votre crontab:

```bash
# Exécuter tous les jours à 2h du matin
0 2 * * * cd /chemin/vers/projet && npx tsx scripts/update-expired-subscriptions.ts >> /var/log/subscription-update.log 2>&1
```

## 🌐 Option 3: API Endpoint

### Endpoint

```
POST /api/admin/subscriptions/update-expired
```

### Authentification

- Requiert une authentification
- Seuls les super-admins peuvent exécuter cette action

### Exemple d'utilisation

```bash
curl -X POST https://votre-domaine.com/api/admin/subscriptions/update-expired \
  -H "Cookie: your-auth-cookie" \
  -H "Content-Type: application/json"
```

### Réponse

```json
{
  "success": true,
  "message": "Updated 3 expired subscription(s)",
  "updatedCount": 3,
  "subscriptionIds": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ],
  "emailsSent": 6,
  "emailErrors": [],
  "executedAt": "2024-01-15T02:00:00.000Z"
}
```

**Champs de réponse** :
- `updatedCount` : Nombre de souscriptions mises à jour
- `subscriptionIds` : Liste des IDs des souscriptions mises à jour
- `emailsSent` : Nombre d'emails envoyés avec succès
- `emailErrors` : Liste des erreurs d'envoi d'email (si applicable)

## 📊 Vue de surveillance

Une vue SQL est également créée pour surveiller les souscriptions proches de l'expiration:

```sql
SELECT * FROM subscriptions_expiring_soon;
```

Cette vue montre les souscriptions qui vont expirer dans les 10 prochains jours, utile pour envoyer des notifications préventives.

## 🔍 Vérification

Pour vérifier les souscriptions qui seront mises à jour lors de la prochaine exécution:

```sql
SELECT 
    id,
    organization_id,
    status,
    current_period_end,
    end_date,
    cancel_at_period_end,
    CASE 
        WHEN cancel_at_period_end = true THEN current_period_end
        WHEN end_date IS NOT NULL THEN end_date
        ELSE current_period_end
    END AS effective_expiration_date,
    CASE 
        WHEN cancel_at_period_end = true THEN current_period_end
        WHEN end_date IS NOT NULL THEN end_date
        ELSE current_period_end
    END - CURRENT_DATE AS days_until_expiration
FROM subscriptions
WHERE status IN ('active', 'trialing', 'past_due')
AND (
    (cancel_at_period_end = true AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
    OR
    (end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '5 days')
    OR
    (end_date IS NULL AND cancel_at_period_end = false AND current_period_end < CURRENT_DATE - INTERVAL '5 days')
);
```

## ⚠️ Notes importantes

1. **Délai de grâce** : Le script attend 5 jours après l'expiration avant de mettre à jour le statut. Cela permet:
   - De gérer les retards de paiement
   - D'envoyer des notifications avant la suspension
   - De laisser le temps aux utilisateurs de renouveler

2. **Statut `trialing`** : Les abonnements en période d'essai sont également vérifiés et peuvent être expirés.

3. **Statut `past_due`** : Les abonnements en retard de paiement sont également vérifiés.

4. **Exécution quotidienne recommandée** : Il est recommandé d'exécuter ce script quotidiennement pour maintenir les statuts à jour.

## 🚀 Déploiement

### Supabase

Si vous utilisez Supabase, vous pouvez configurer un cron job via pg_cron ou utiliser les Edge Functions.

### Vercel / Next.js

Pour un déploiement sur Vercel, utilisez Vercel Cron Jobs:

1. Créez `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/admin/subscriptions/update-expired",
    "schedule": "0 2 * * *"
  }]
}
```

2. L'endpoint sera appelé automatiquement tous les jours à 2h du matin.

