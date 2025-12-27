'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2,
  MapPin,
  Plus,
  Edit,
  ChevronRight,
  Download,
  Leaf,
  Shield,
  AlertTriangle,
  Flame,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileText,
  Calendar,
  Wrench,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { AccessDeniedAction } from '@/components/ui/access-denied-action';

// Dynamically import the map component to avoid SSR issues
const PropertyMap = dynamic(() => import('@/components/ui/property-map').then(mod => ({ default: mod.PropertyMap })), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">Chargement de la carte...</div>,
});

// Fetch property details from API
async function getPropertyDetails(id: string) {
  const response = await fetch(`/api/properties/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch property details');
  }
  return response.json();
}

export default function PropertyDetailsPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const { canAccessFeature, canAccessObject } = useAccess();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: property, isLoading } = useDataQuery(
    ['property-details', propertyId],
    () => getPropertyDetails(propertyId)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  // User needs either canViewAllProperties OR canRead access
  const hasViewAllAccess = canAccessFeature('properties_management', 'canViewAllProperties');
  const hasReadAccess = canAccessObject('Property', 'read');
  const canEdit = canAccessObject('Property', 'edit');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Détails du bien"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Bien non trouvé
        </h3>
        <Link href="/properties">
          <Button>Retour aux biens</Button>
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M FCFA`;
    }
    return `${(amount / 1000).toFixed(0)}K FCFA`;
  };

  const nextPhoto = () => {
    if (property.photos && property.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % property.photos.length);
    }
  };

  const prevPhoto = () => {
    if (property.photos && property.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + property.photos.length) % property.photos.length);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/properties" className="hover:text-blue-600">
          Biens
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{property.name}</span>
      </div>

      {/* Property Overview */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{property.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <MapPin className="h-4 w-4" />
            <span>{property.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span>{property.totalUnits} lots</span>
            <span>•</span>
            <span>Acquis en {property.acquisitionYear}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/properties/${property.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Link>
            </Button>
          ) : (
            <AccessDeniedAction
              requiredPermission="Modifier des biens"
              reason="permission"
              featureName="Gestion des biens"
            >
              <Button variant="outline" disabled>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </AccessDeniedAction>
          )}
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un lot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos */}
          {property.photos && property.photos.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Photos du bien</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter des photos
                </Button>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="relative h-96 w-full rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={property.photos[currentPhotoIndex].url}
                      alt={property.photos[currentPhotoIndex].alt}
                      fill
                      className="object-cover"
                    />
                    {property.photos.length > 1 && (
                      <>
                        <button
                          onClick={prevPhoto}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={nextPhoto}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {property.photos.slice(0, 2).map((photo: any, index: number) => (
                      <div
                        key={photo.id}
                        className="relative h-24 w-32 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-600"
                        onClick={() => setCurrentPhotoIndex(index)}
                      >
                        <Image
                          src={photo.url}
                          alt={photo.alt}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-600">
                    <span>{currentPhotoIndex + 1}/{property.photos.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          {property.latitude && property.longitude && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Localisation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PropertyMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  propertyName={property.name}
                  address={property.address}
                  city={property.city}
                />
              </CardContent>
            </Card>
          )}

          {/* Diagnostics & Conformité */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Diagnostics & Conformité</CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un diagnostic
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {property.diagnostics.map((diagnostic: any) => {
                  const Icon = diagnostic.icon;
                  return (
                    <div
                      key={diagnostic.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-lg ${
                          diagnostic.status === 'valid' ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            diagnostic.status === 'valid' ? 'text-green-600' : 'text-yellow-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{diagnostic.type}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={diagnostic.status === 'valid' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {diagnostic.statusText}
                            </Badge>
                            <span className="text-sm text-gray-600">{diagnostic.provider}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Expire le {diagnostic.expiryDate}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Titre de propriété & Propriétaires */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Titre de propriété & Propriétaires</CardTitle>
              {canEdit ? (
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              ) : (
                <AccessDeniedAction
                  requiredPermission="Modifier des biens"
                  reason="permission"
                  featureName="Gestion des biens"
                >
                  <Button variant="outline" size="sm" disabled>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </AccessDeniedAction>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Property Title */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Titre Foncier N°</p>
                    <p className="font-semibold text-gray-900">{property.title.landTitleNumber}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Date d'acquisition</p>
                    <p className="font-medium">{property.title.acquisitionDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Surface totale</p>
                    <p className="font-medium">{property.title.totalSurface} m²</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Valeur d'acquisition</p>
                    <p className="font-medium">{formatCurrency(property.title.acquisitionValue)}</p>
                  </div>
                </div>
              </div>

              {/* Owners */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Propriétaires ({property.owners.length})</h4>
                <div className="space-y-3">
                  {property.owners.map((owner: any) => (
                    <div
                      key={owner.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={owner.avatar} alt={owner.name} />
                          <AvatarFallback>{owner.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900">{owner.name}</p>
                          <p className="text-sm text-gray-600">
                            Quote-part: {owner.share}% • Revenus mensuels: {formatCurrency(owner.monthlyRevenue)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Occupancy Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Taux d'occupation</span>
                  <span className="font-bold text-gray-900">{property.stats.occupancyRate}%</span>
                </div>
                <Progress
                  value={property.stats.occupancyRate}
                  className="h-3 bg-gray-200"
                  indicatorClassName="bg-green-500"
                />
              </div>

              {/* Monthly Revenue */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">Revenus mensuels</span>
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(property.stats.monthlyRevenue)}</span>
              </div>

              {/* Annual Yield */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Rendement annuel</span>
                </div>
                <span className="font-bold text-gray-900">{property.stats.annualYield}%</span>
              </div>

              {/* Current Value */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-gray-600">Valeur actuelle</span>
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(property.stats.currentValue)}</span>
              </div>

              {/* Outstanding Payments */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-gray-600">Impayés en cours</span>
                </div>
                <span className="font-bold text-red-600">{formatCurrency(property.stats.outstandingPayments)}</span>
              </div>
            </CardContent>
          </Card>

          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Type de bien</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.propertyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Année de construction</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.constructionYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nombre d'étages</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.floors} étages</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Surface totale</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.totalSurface} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Ascenseur</span>
                  <span className="text-sm font-medium text-gray-900">
                    {property.generalInfo.hasElevator ? 'Oui' : 'Non'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Parking</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.parkingSpaces} places</span>
                </div>
                <div className="flex justify-between pt-4 border-t">
                  <span className="text-sm text-gray-600">Syndic</span>
                  <span className="text-sm font-medium text-gray-900">{property.generalInfo.propertyManager}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {property.recentActivity.map((activity: any) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-gray-100 ${activity.iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-600">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

