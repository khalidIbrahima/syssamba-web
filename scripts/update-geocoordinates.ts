/**
 * Script pour mettre à jour les coordonnées géographiques des biens et lots
 * Utilise l'API Nominatim (OpenStreetMap) pour le géocodage
 * 
 * Usage: tsx scripts/update-geocoordinates.ts [--property-id=<id>] [--unit-id=<id>] [--all]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement depuis .env.local ou .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env ou .env.local');
  console.error('');
  console.error('Ajoutez ces variables dans votre fichier .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key');
  console.error('');
  console.error('Vous pouvez obtenir ces valeurs depuis:');
  console.error('  https://supabase.com/dashboard > Votre projet > Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Géocode une adresse en utilisant Nominatim (OpenStreetMap)
 */
async function geocodeAddress(address: string, city?: string): Promise<GeocodeResult | null> {
  try {
    const query = city ? `${address}, ${city}` : address;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    console.log(`🔍 Géocodage: ${query}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SambaOne-Geocoding-Script/1.0', // Nominatim exige un User-Agent
      },
    });

    if (!response.ok) {
      console.error(`❌ Erreur HTTP: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      console.log(`✅ Coordonnées trouvées: ${result.lat}, ${result.lon}`);
      return {
        lat: result.lat,
        lon: result.lon,
        display_name: result.display_name,
      };
    }

    console.log(`⚠️  Aucun résultat pour: ${query}`);
    return null;
  } catch (error) {
    console.error(`❌ Erreur lors du géocodage:`, error);
    return null;
  }
}

/**
 * Met à jour les coordonnées d'un bien
 */
async function updatePropertyCoordinates(propertyId: string) {
  try {
    // Récupérer le bien
    const { data: property, error: fetchError } = await supabase
      .from('properties')
      .select('id, name, address, city, latitude, longitude')
      .eq('id', propertyId)
      .single();

    if (fetchError || !property) {
      console.error(`❌ Bien non trouvé: ${propertyId}`);
      return;
    }

    // Si le bien a déjà des coordonnées, on peut les garder ou les mettre à jour
    if (property.latitude && property.longitude) {
      console.log(`ℹ️  Le bien ${property.name} a déjà des coordonnées. Utilisez --force pour forcer la mise à jour.`);
      return;
    }

    // Géocoder l'adresse
    const geocodeResult = await geocodeAddress(property.address, property.city || undefined);
    
    if (!geocodeResult) {
      console.log(`⚠️  Impossible de géocoder le bien: ${property.name}`);
      return;
    }

    // Mettre à jour le bien
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        latitude: geocodeResult.lat,
        longitude: geocodeResult.lon,
      })
      .eq('id', propertyId);

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour:`, updateError);
      return;
    }

    console.log(`✅ Bien mis à jour: ${property.name} -> ${geocodeResult.lat}, ${geocodeResult.lon}`);
  } catch (error) {
    console.error(`❌ Erreur:`, error);
  }
}

/**
 * Met à jour les coordonnées d'un lot (utilise les coordonnées du bien associé)
 */
async function updateUnitCoordinates(unitId: string) {
  try {
    // Récupérer le lot avec son bien
    const { data: unit, error: fetchError } = await supabase
      .from('units')
      .select(`
        id,
        unit_number,
        property_id,
        properties (
          id,
          name,
          address,
          city,
          latitude,
          longitude
        )
      `)
      .eq('id', unitId)
      .single();

    if (fetchError || !unit) {
      console.error(`❌ Lot non trouvé: ${unitId}`);
      return;
    }

    const property = unit.properties as any;

    if (!property) {
      console.log(`⚠️  Le lot ${unit.unit_number} n'a pas de bien associé`);
      return;
    }

    // Si le bien a des coordonnées, on les utilise pour le lot
    if (property.latitude && property.longitude) {
      // Les lots utilisent les coordonnées du bien (pas de colonne latitude/longitude dans units)
      console.log(`ℹ️  Le lot ${unit.unit_number} utilise les coordonnées du bien: ${property.latitude}, ${property.longitude}`);
      return;
    }

    // Si le bien n'a pas de coordonnées, on les géocode
    const geocodeResult = await geocodeAddress(property.address, property.city || undefined);
    
    if (!geocodeResult) {
      console.log(`⚠️  Impossible de géocoder le bien associé: ${property.name}`);
      return;
    }

    // Mettre à jour le bien
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        latitude: geocodeResult.lat,
        longitude: geocodeResult.lon,
      })
      .eq('id', property.id);

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour:`, updateError);
      return;
    }

    console.log(`✅ Bien mis à jour pour le lot ${unit.unit_number}: ${property.name} -> ${geocodeResult.lat}, ${geocodeResult.lon}`);
  } catch (error) {
    console.error(`❌ Erreur:`, error);
  }
}

/**
 * Met à jour tous les biens sans coordonnées
 */
async function updateAllProperties() {
  try {
    // Récupérer tous les biens sans coordonnées
    const { data: properties, error: fetchError } = await supabase
      .from('properties')
      .select('id, name, address, city, latitude, longitude')
      .or('latitude.is.null,longitude.is.null');

    if (fetchError) {
      console.error(`❌ Erreur lors de la récupération:`, fetchError);
      return;
    }

    if (!properties || properties.length === 0) {
      console.log(`✅ Tous les biens ont déjà des coordonnées`);
      return;
    }

    console.log(`📋 ${properties.length} bien(s) à mettre à jour\n`);

    for (const property of properties) {
      // Attendre 1 seconde entre chaque requête pour respecter le rate limit de Nominatim
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const geocodeResult = await geocodeAddress(property.address, property.city || undefined);
      
      if (!geocodeResult) {
        console.log(`⚠️  Impossible de géocoder: ${property.name}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('properties')
        .update({
          latitude: geocodeResult.lat,
          longitude: geocodeResult.lon,
        })
        .eq('id', property.id);

      if (updateError) {
        console.error(`❌ Erreur lors de la mise à jour de ${property.name}:`, updateError);
        continue;
      }

      console.log(`✅ ${property.name} -> ${geocodeResult.lat}, ${geocodeResult.lon}`);
    }

    console.log(`\n✅ Mise à jour terminée`);
  } catch (error) {
    console.error(`❌ Erreur:`, error);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  const propertyIdArg = args.find(arg => arg.startsWith('--property-id='));
  const unitIdArg = args.find(arg => arg.startsWith('--unit-id='));
  const allArg = args.includes('--all');

  if (propertyIdArg) {
    const propertyId = propertyIdArg.split('=')[1];
    await updatePropertyCoordinates(propertyId);
  } else if (unitIdArg) {
    const unitId = unitIdArg.split('=')[1];
    await updateUnitCoordinates(unitId);
  } else if (allArg) {
    await updateAllProperties();
  } else {
    console.log(`
Usage:
  tsx scripts/update-geocoordinates.ts --property-id=<id>    Mettre à jour un bien spécifique
  tsx scripts/update-geocoordinates.ts --unit-id=<id>       Mettre à jour le bien d'un lot
  tsx scripts/update-geocoordinates.ts --all                Mettre à jour tous les biens sans coordonnées

Exemples:
  tsx scripts/update-geocoordinates.ts --property-id=123e4567-e89b-12d3-a456-426614174000
  tsx scripts/update-geocoordinates.ts --all
    `);
  }
}

main().catch(console.error);

