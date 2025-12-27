# SAMBA ONE - Gestion Immobilière

Plateforme complète de gestion immobilière adaptée au Sénégal et à l'espace OHADA.

## 🚀 Fonctionnalités

- ✅ **Gestion des propriétés** - Multi-propriétés avec photos et détails
- ✅ **Gestion des locataires** - Annuaire complet avec extranet
- ✅ **Baux et contrats** - Création et signature électronique
- ✅ **Paiements intégrés** - Wave, Orange Money, Stripe
- ✅ **Comptabilité SYSCOHADA** - Écritures automatiques
- ✅ **Tâches & maintenance** - Kanban avec assignation
- ✅ **Mode hors ligne** - PWA pour interventions sur terrain
- ✅ **Permissions par plan** - Freemium → Enterprise

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 App Router, React 18, TypeScript
- **UI**: Tailwind CSS + ShadCN UI
- **Auth**: Clerk Authentication
- **Database**: PostgreSQL + Drizzle ORM
- **State**: Tanstack React Query
- **Forms**: React Hook Form + Zod
- **PWA**: Next.js PWA (mode offline)
- **Paiements**: Wave API, Orange Money API, Stripe

## 📋 Prérequis

- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose

## 🚀 Installation

1. **Cloner le repository**
   ```bash
   git clone <repository-url>
   cd samba-one
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer la base de données**
   ```bash
   docker-compose up -d
   ```

4. **Configurer les variables d'environnement**
   ```bash
   # Le fichier .env contient des valeurs par défaut (peut être commité)
   # Copiez et modifiez .env.local pour vos valeurs personnelles (ignoré par git)
   cp .env .env.local
   ```

   Remplir `.env.local` avec vos clés API :
   - **Supabase** (obligatoire - https://supabase.com/dashboard)
   - Clerk (optionnel - https://clerk.com)
   - Stripe (optionnel)
   - Wave Money API (optionnel - sandbox)

   **Configuration Supabase :**
   1. Créer un projet sur https://supabase.com
   2. Aller dans Settings > API
   3. Copier Project URL et anon public key
   4. Remplacer les valeurs dans `.env.local`
   - Orange Money API (sandbox)

5. **Initialiser la base de données**
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

6. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

## 📁 Structure du Projet

```
samba-one/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Pages protégées
│   │   │   ├── dashboard/     # Dashboard principal
│   │   │   ├── properties/    # Gestion propriétés
│   │   │   ├── tenants/       # Gestion locataires
│   │   │   ├── leases/        # Gestion baux
│   │   │   ├── payments/      # Gestion paiements
│   │   │   ├── accounting/    # Comptabilité
│   │   │   ├── tasks/         # Gestion tâches
│   │   │   └── settings/      # Paramètres
│   │   ├── auth/              # Authentification Clerk
│   │   ├── extranet/          # Portail locataire
│   │   ├── layout.tsx         # Layout principal
│   │   └── page.tsx           # Page d'accueil
│   ├── components/            # Composants React
│   │   ├── ui/               # Composants ShadCN
│   │   ├── layout/           # Layout (sidebar, header)
│   │   └── providers/        # Context providers
│   ├── lib/                  # Utilitaires
│   │   ├── db.ts             # Connexion DB
│   │   ├── clerk.ts          # Utilitaires auth
│   │   ├── permissions.ts    # Système permissions
│   │   └── utils.ts          # Fonctions utilitaires
│   ├── hooks/               # Custom hooks
│   ├── types/               # Types TypeScript
│   └── middleware.ts        # Middleware protection routes
├── public/                  # Assets statiques
├── init-db/                # Scripts d'initialisation DB
├── drizzle.config.ts       # Configuration Drizzle
├── tailwind.config.ts      # Configuration Tailwind
└── components.json         # Configuration ShadCN
```

## 🎯 Plans et Limites

| Fonctionnalité | Freemium | Starter | Pro | Agence | Enterprise |
|---------------|----------|---------|-----|---------|------------|
| Lots | 5 | 30 | 150 | ∞ | ∞ |
| Utilisateurs | 1 | 2 | 5 | 15 | ∞ |
| Extranet | 5 | 50 | 300 | ∞ | ∞ |
| Comptabilité | ❌ | ❌ | ✅ | ✅ | ✅ |
| API | ❌ | ❌ | ✅ | ✅ | ✅ |
| Domaine perso | ❌ | ❌ | ❌ | ✅ | ✅ |

## 🧪 Scripts Disponibles

```bash
# Développement
npm run dev          # Serveur développement
npm run build        # Build production
npm run start        # Serveur production
npm run lint         # Vérification ESLint

# Base de données
npm run db:generate  # Générer migrations
npm run db:push      # Appliquer migrations
npm run db:studio    # Interface Drizzle Studio
```

## 🔐 Authentification

L'application utilise Clerk pour l'authentification avec :
- Connexion téléphone + Google
- Gestion des rôles utilisateur
- Protection des routes par middleware
- Sessions sécurisées

## 💳 Intégrations Paiement

- **Wave Money** : Paiements mobiles au Sénégal
- **Orange Money** : Portefeuille électronique
- **Stripe** : Paiements internationaux (optionnel)

## 📱 PWA & Mode Offline

- Service Worker pour cache offline
- Mode hors ligne pour états des lieux
- Synchronisation automatique

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 📞 Support

Pour toute question ou support :
- 📧 Email: support@samba-one.com
- 📱 WhatsApp: +221 XX XXX XX XX
- 💬 Discord: [Rejoignez notre communauté](https://discord.gg/samba-one)

---

**SAMBA ONE** - Révolutionnez la gestion immobilière au Sénégal 🇸🇳
