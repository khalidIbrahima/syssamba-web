# Système de Sécurité Inspiré de Salesforce

## Vue d'ensemble

Ce système implémente un modèle de sécurité multi-niveaux inspiré de Salesforce, offrant un contrôle d'accès granulaire à tous les niveaux de l'application.

**Version actuelle:** Focus sur Object-Level Security (OLS) et Field-Level Security (FLS)

## Architecture Multi-Niveaux

### 1. Object-Level Security (OLS)
**Contrôle l'accès aux objets (tables)**

- Définit quels objets un utilisateur peut voir/modifier
- Permissions par plan et rôle
- Actions: `create`, `read`, `edit`, `delete`, `viewAll`

**Exemple:**
- Un `viewer` peut lire les `Property` mais ne peut pas les créer
- Un `accountant` peut lire/éditer les `Payment` mais pas les `Property`

### 2. Field-Level Security (FLS)
**Contrôle l'accès aux champs spécifiques**

- Définit quels champs un utilisateur peut voir/modifier
- Protection des données sensibles (financières, personnelles)
- Permissions par plan et rôle

**Exemple:**
- Un `agent` peut voir `rentAmount` mais pas `purchasePrice`
- Un `viewer` peut voir `tenantName` mais pas `tenantEmail`

### 3. Record-Level Security (RLS) - Basique
**Contrôle l'accès aux enregistrements individuels (simplifié)**

- Vérification de propriété (ownership)
- Vérification des frontières organisationnelles
- Support pour `can_view_all` vs `can_view_own`

**Note:** Les fonctionnalités avancées (hiérarchie des rôles, règles de partage) seront ajoutées ultérieurement.

## Structure de la Base de Données

### Tables Principales

1. **`object_permissions`**: Permissions au niveau objet
   - Contrôle l'accès aux types d'objets (Property, Unit, Tenant, etc.)
   - Permissions par plan et rôle
   - Actions: create, read, edit, delete, viewAll

2. **`field_permissions`**: Permissions au niveau champ
   - Contrôle l'accès aux champs spécifiques
   - Protection des données sensibles
   - Permissions par plan et rôle

## Utilisation

### Dans les Composants React

```typescript
import { useSecurity } from '@/hooks/use-security';

function PropertyCard({ property }) {
  const { canAccessRecord, filterRecordFields } = useSecurity();
  
  // Vérifier l'accès à l'enregistrement
  const canEdit = await canAccessRecord('Property', property.id, 'edit');
  
  // Filtrer les champs selon FLS
  const filteredProperty = await filterRecordFields('Property', property);
  
  return (
    <div>
      {canEdit && <EditButton />}
      <PropertyDetails data={filteredProperty} />
    </div>
  );
}
```

### Dans les API Routes

```typescript
import { getRecordAccess, filterFieldsBySecurity } from '@/lib/access-control';

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const organizationId = await getCurrentOrganizationId();
  
  // Vérifier l'accès à l'enregistrement
  const canRead = await getRecordAccess(
    userId,
    organizationId,
    'Property',
    propertyId,
    'read'
  );
  
  if (!canRead) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  
  // Filtrer les champs selon FLS
  const filteredProperty = await filterFieldsBySecurity(
    userId,
    organizationId,
    'Property',
    property
  );
  
  return NextResponse.json(filteredProperty);
}
```

## Flux de Vérification

Lorsqu'un utilisateur tente d'accéder à un enregistrement:

1. **Object-Level Check**: L'utilisateur a-t-il accès à ce type d'objet?
2. **Action Check**: L'utilisateur peut-il effectuer cette action (read/edit/delete)?
3. **Record-Level Check (Basique)**: 
   - L'utilisateur est-il propriétaire?
   - L'utilisateur peut-il voir tous les enregistrements (`can_view_all`)?
   - L'enregistrement appartient-il à la même organisation?
4. **Field-Level Check**: Quels champs l'utilisateur peut-il voir/modifier?

## Avantages

1. **Granularité**: Contrôle précis à tous les niveaux
2. **Flexibilité**: Configuration par organisation
3. **Sécurité**: Protection multi-niveaux
4. **Auditabilité**: Traçabilité complète des accès
5. **Scalabilité**: Performance optimisée avec index

## Migration

Pour activer ce système:

1. Exécuter `init-db/37-create-salesforce-inspired-security-tables.sql`
2. Migrer les permissions existantes vers les nouvelles tables
3. Mettre à jour les API routes pour utiliser le nouveau système
4. Mettre à jour les composants React pour utiliser `useSecurity`

## Configuration

Les permissions peuvent être configurées via:
- Interface d'administration (`/settings/users`)
- API d'administration
- Scripts de migration

