/**
 * Liste des pays OHADA (Organisation pour l'Harmonisation en Afrique du Droit des Affaires)
 * et autres pays d'Afrique de l'Ouest et Centrale
 */

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string; // Nom en français
  currency: string; // Code devise (ISO 4217)
  currencySymbol: string; // Symbole de la devise
}

export const OHADA_COUNTRIES: Country[] = [
  { code: 'SN', name: 'Sénégal', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'KM', name: 'Comores', currency: 'KMF', currencySymbol: 'KMF' },
  { code: 'CG', name: 'Congo', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'CD', name: 'République démocratique du Congo', currency: 'CDF', currencySymbol: 'CDF' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'GN', name: 'Guinée', currency: 'GNF', currencySymbol: 'GNF' },
  { code: 'GW', name: 'Guinée-Bissau', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'GQ', name: 'Guinée équatoriale', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'ML', name: 'Mali', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'NE', name: 'Niger', currency: 'XOF', currencySymbol: 'FCFA' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', currencySymbol: 'FCFA' },
  { code: 'TG', name: 'Togo', currency: 'XOF', currencySymbol: 'FCFA' },
];

// Autres pays d'Afrique de l'Ouest (non-OHADA mais proches)
export const OTHER_AFRICAN_COUNTRIES: Country[] = [
  { code: 'MR', name: 'Mauritanie', currency: 'MRU', currencySymbol: 'MRU' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', currencySymbol: 'GHS' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', currencySymbol: 'NGN' },
];

// Tous les pays disponibles
export const ALL_COUNTRIES = [...OHADA_COUNTRIES, ...OTHER_AFRICAN_COUNTRIES];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return ALL_COUNTRIES.find((country) => country.code === code);
}

/**
 * Get default country (Sénégal)
 */
export function getDefaultCountry(): Country {
  return OHADA_COUNTRIES.find((c) => c.code === 'SN') || OHADA_COUNTRIES[0];
}

