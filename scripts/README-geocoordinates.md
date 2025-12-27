# Script de mise à jour des coordonnées géographiques

Ce script permet de mettre à jour automatiquement les coordonnées géographiques (latitude/longitude) des biens immobiliers en utilisant l'API Nominatim (OpenStreetMap).

## Prérequis

### 1. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env.local` (ou `.env`) :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

**Où trouver ces valeurs :**
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important :** Ne partagez jamais votre `SUPABASE_SERVICE_ROLE_KEY` publiquement. Elle donne un accès complet à votre base de données.

### 2. Installation des dépendances

Le script utilise `dotenv` pour charger les variables d'environnement. Si ce n'est pas déjà installé :

```bash
npm install dotenv
```

## Utilisation

### Géocoder tous les biens sans coordonnées

```bash
npm run update-geocoordinates -- --all
```

### Géocoder un bien spécifique

```bash
npm run update-geocoordinates -- --property-id=<UUID>
```

Exemple :
```bash
npm run update-geocoordinates -- --property-id=123e4567-e89b-12d3-a456-426614174000
```

### Géocoder le bien associé à un lot

```bash
npm run update-geocoordinates -- --unit-id=<UUID>
```

## Fonctionnement

1. Le script récupère les biens sans coordonnées depuis Supabase
2. Pour chaque bien, il construit une adresse complète (adresse + ville)
3. Il appelle l'API Nominatim pour géocoder l'adresse
4. Il met à jour les coordonnées dans Supabase
5. Il respecte la limite de taux de Nominatim (1 requête/seconde)

## Limitations

- **Limite de taux Nominatim :** 1 requête par seconde (respectée automatiquement)
- **Précision :** Dépend de la qualité de l'adresse dans la base de données
- **Adresses non trouvées :** Certaines adresses peuvent ne pas être trouvées par Nominatim

## Dépannage

### Erreur : "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis"

**Solution :**
1. Vérifiez que le fichier `.env.local` existe à la racine du projet
2. Vérifiez que les variables sont bien définies (sans espaces autour du `=`)
3. Redémarrez votre terminal après avoir ajouté les variables

### Erreur : "Cannot find module 'dotenv'"

**Solution :**
```bash
npm install dotenv
```

### Aucun résultat pour certaines adresses

**Solution :**
- Vérifiez que l'adresse est complète et correcte dans la base de données
- Essayez d'ajouter la ville si elle manque
- Certaines adresses peuvent nécessiter une mise à jour manuelle

## Exemple de sortie

```
📋 5 bien(s) à mettre à jour

🔍 Géocodage: 123 Rue de la République, Dakar
✅ Coordonnées trouvées: 14.7167, -17.4677
✅ Résidence Les Almadies -> 14.7167, -17.4677

🔍 Géocodage: 456 Avenue Bourguiba, Dakar
✅ Coordonnées trouvées: 14.7233, -17.4833
✅ Villa Ouakam -> 14.7233, -17.4833

...

✅ Mise à jour terminée
```

## Vérification

Après avoir exécuté le script, vous pouvez vérifier les résultats dans Supabase :

```sql
-- Voir les propriétés avec coordonnées
SELECT name, address, latitude, longitude 
FROM properties 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Voir les statistiques
SELECT * FROM properties_geolocation_stats;
```
