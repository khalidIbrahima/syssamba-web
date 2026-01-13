# Intégration Stripe - Guide de configuration

Ce guide explique comment configurer et utiliser l'intégration Stripe pour les paiements de plans.

## Configuration

### Variables d'environnement requises

Ajoutez les variables suivantes dans votre fichier `.env.local` :

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # Ou sk_live_... pour la production
STRIPE_WEBHOOK_SECRET=whsec_... # Secret du webhook (récupéré depuis le dashboard Stripe)

# URL de l'application (pour les redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000 # En production: https://votre-domaine.com
```

### Configuration dans Stripe Dashboard

1. **Créer un compte Stripe** : https://stripe.com
2. **Récupérer les clés API** :
   - Allez dans Developers > API keys
   - Copiez la "Secret key" (commence par `sk_test_` en mode test, `sk_live_` en production)
   - Ajoutez-la à `STRIPE_SECRET_KEY`

3. **Configurer le webhook** :
   - Allez dans Developers > Webhooks
   - Cliquez sur "Add endpoint"
   - URL du webhook : `https://votre-domaine.com/api/webhooks/stripe`
   - Événements à écouter :
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copiez le "Signing secret" (commence par `whsec_`) et ajoutez-le à `STRIPE_WEBHOOK_SECRET`

## Fonctionnalités

### Mode de paiement actuel

L'application utilise le **mode "subscription"** de Stripe Checkout, qui permet des **paiements récurrents automatiques**. Les abonnements sont renouvelés automatiquement selon la période de facturation (mensuelle ou annuelle).

### Flux de paiement

1. **Sélection d'un plan** :
   - L'utilisateur choisit un plan sur `/settings/subscription` ou `/pricing`
   - Un appel API est fait à `/api/subscription/checkout` ou `/api/subscription/upgrade`

2. **Création de la session Checkout** :
   - Une session Stripe Checkout est créée
   - L'utilisateur est redirigé vers Stripe pour le paiement

3. **Retour après paiement** :
   - En cas de succès : redirection vers `/settings/subscription?success=true&session_id=...`
   - La route `/api/subscription/success` finalise l'abonnement

4. **Renouvellement automatique** :
   - Stripe facture automatiquement l'utilisateur selon la période choisie (mensuelle ou annuelle)
   - Les événements sont reçus via les webhooks

5. **Webhooks Stripe** :
   - Les événements Stripe sont reçus sur `/api/webhooks/stripe`
   - Les abonnements sont mis à jour automatiquement (renouvellements, annulations, échecs de paiement)

## Routes API

### POST /api/subscription/checkout

Crée une session Stripe Checkout pour un plan.

**Body** :
```json
{
  "planId": "uuid-du-plan",
  "billingPeriod": "monthly" | "yearly"
}
```

**Response** :
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_..."
}
```

### POST /api/subscription/upgrade

Met à jour ou crée un abonnement. Pour les plans payants, redirige vers Stripe Checkout.

**Body** :
```json
{
  "planId": "uuid-du-plan",
  "billingPeriod": "monthly" | "yearly"
}
```

### GET /api/subscription/success

Finalise l'abonnement après un paiement réussi.

**Query params** :
- `session_id` : ID de la session Stripe Checkout

### POST /api/webhooks/stripe

Webhook Stripe pour gérer les événements automatiquement.

## Gestion des Prices Stripe

Le système crée automatiquement les **Products** et **Prices** Stripe lors du premier checkout pour chaque plan. Les Prices sont recherchées et réutilisées si elles existent déjà, évitant les doublons.

### Fonctionnement automatique

- Lorsqu'un utilisateur achète un plan, le système :
  1. Recherche un Product Stripe existant avec le nom du plan dans les métadonnées
  2. Si le Product n'existe pas, il est créé automatiquement
  3. Recherche un Price existant pour ce Product et cette période (mensuel/annuel)
  4. Si le Price n'existe pas ou si le montant a changé, un nouveau Price est créé
  5. L'ancien Price est désactivé si le montant a changé

### Gestion manuelle (optionnel)

Si vous préférez créer manuellement les Products et Prices dans le Stripe Dashboard :

1. Créez un Product pour chaque plan
2. Créez des Prices récurrents (mensuel et annuel) pour chaque Product
3. Ajoutez des métadonnées au Product : `plan_name` = nom du plan
4. Le système utilisera automatiquement ces Prices existantes

## Test en mode développement

Stripe fournit des cartes de test :

- **Carte de test réussie** : `4242 4242 4242 4242`
- **Carte refusée** : `4000 0000 0000 0002`
- **Date d'expiration** : n'importe quelle date future (ex: 12/34)
- **CVC** : n'importe quel 3 chiffres (ex: 123)

## Dépannage

### Le webhook ne fonctionne pas

- Vérifiez que `STRIPE_WEBHOOK_SECRET` est correct
- Vérifiez que l'URL du webhook est accessible publiquement
- En développement local, utilisez Stripe CLI : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Les paiements ne sont pas enregistrés

- Vérifiez les logs du serveur pour les erreurs
- Vérifiez que la route `/api/subscription/success` est appelée après le paiement
- Vérifiez que le webhook reçoit les événements

### Erreur "Stripe is not configured"

- Vérifiez que `STRIPE_SECRET_KEY` est défini dans `.env.local`
- Redémarrez le serveur de développement après avoir ajouté la variable

## Gestion de la TVA

### Règle fiscale : TVA selon la localisation du client

Le système applique automatiquement les règles fiscales sénégalaises pour la TVA sur les services numériques :

- **Clients sénégalais** : TVA de 18% (ou le taux défini dans `countries.tva` pour le Sénégal)
- **Clients non-sénégalais** : TVA = 0% (exonération pour exportation de services, conformément à l'article 363 du CGI)

### Récupération automatique du taux de TVA

Le système récupère automatiquement le taux de TVA depuis la table `countries` en fonction du pays de l'organisation :

1. Le système récupère le code pays de l'organisation (colonne `organizations.country`)
2. **Si le client est au Sénégal (code = 'SN')** :
   - Il interroge la table `countries` pour obtenir le taux de TVA sénégalaise (colonne `countries.tva`)
   - Applique le taux de TVA (par défaut 18%)
3. **Si le client n'est pas au Sénégal** :
   - TVA = 0% (exonération exportation)
4. Le taux de TVA est inclus dans les métadonnées de la facture Stripe

### Affichage de la TVA sur les factures

Les sessions Stripe Checkout en mode `subscription` génèrent automatiquement des factures pour chaque paiement. Les factures incluent :
- Un résumé détaillé de la facture sur l'écran de paiement Stripe
- Des factures téléchargeables disponibles dans le Stripe Customer Portal
- Les métadonnées de la session et de l'abonnement incluent le taux de TVA et le code pays (0% pour exportation, taux local pour Sénégal)

**Note** : Pour les abonnements Stripe, les factures sont créées automatiquement. Le paramètre `invoice_creation` n'est utilisé que pour le mode `payment` (paiements uniques), pas pour `subscription`.

### Conformité fiscale

**Pour les déclarations DGID (Direction Générale des Impôts et Domaines)** :
- Les abonnements de clients sénégalais sont soumis à TVA et doivent être reversés à la DGID
- Les abonnements de clients non-sénégalais sont exonérés (exportation) et ne nécessitent pas de reversement TVA au Sénégal
- Les factures indiquent clairement le statut (TVA applicable ou exonéré exportation)

**Documentation recommandée** :
- Conservez les preuves de localisation des clients (adresse de facturation, logs IP si nécessaire)
- Les métadonnées Stripe incluent le code pays pour traçabilité

### Configuration de Stripe Tax (optionnel)

Pour activer le calcul automatique de la TVA avec Stripe Tax :

1. **Dans le Stripe Dashboard** :
   - Allez dans Tax settings
   - Configurez votre adresse d'origine
   - Ajoutez vos enregistrements fiscaux pour chaque pays
   - Configurez les codes fiscaux pour vos produits

2. **Activer dans le code** :
   - Dans `/api/subscription/checkout` et `/api/subscription/upgrade`
   - Décommentez la ligne `automatic_tax: { enabled: true }`

Note : Stripe Tax nécessite une configuration supplémentaire dans le dashboard. Si Stripe Tax n'est pas configuré, les prix affichés sont TTC pour les clients sénégalais (TVA incluse) et HT pour les clients non-sénégalais (exonération). Le taux de TVA récupéré depuis la base de données est stocké dans les métadonnées pour référence et déclarations fiscales.

### Tableau récapitulatif

| Scénario | TVA Appliquée | Action dans l'Outil | Impact |
|----------|---------------|---------------------|--------|
| Abonné Sénégalais | 18% sur HT (ou taux `countries.tva`) | Ajouter à la facture, reverser à DGID | Conformité locale obligatoire |
| Abonné Non-Sénégalais | 0% (exonéré exportation) | Facturer HT seulement, log localisation | Simplifie les ventes internationales, ROI potentiel + |

## Support

Pour plus d'informations, consultez :
- Documentation Stripe : https://stripe.com/docs
- Documentation Stripe Checkout : https://stripe.com/docs/payments/checkout
- Documentation Stripe Tax : https://stripe.com/docs/tax
