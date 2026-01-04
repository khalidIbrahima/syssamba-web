'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Home,
  MapPin,
  Edit,
  Share2,
  FileText,
  ChevronRight,
  ChevronLeft,
  Ruler,
  Bed,
  Bath,
  Building2,
  Wifi,
  Droplets,
  Shield,
  ArrowUp,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  MessageSquare,
  User,
  AlertCircle,
  Map,
  Star,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const UnitMap = dynamic(() => import('@/components/ui/unit-map').then(mod => ({ default: mod.UnitMap })), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center">
      <div className="text-muted-foreground">Chargement de la carte...</div>
    </div>
  ),
});

// Fetch unit details from API
async function getUnitDetails(id: string) {
  const response = await fetch(`/api/units/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch unit details');
  }
  return response.json();
}

export default function UnitDetailsPage() {
  const params = useParams();
  const unitId = params.id as string;
  const { canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: unit, isLoading } = useDataQuery(
    ['unit-details', unitId],
    () => getUnitDetails(unitId)
  );

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  if (!unit) {
    return (
      <div className="text-center py-12">
        <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Lot non trouvé
        </h3>
        <Link href="/units">
          <Button>Retour aux lots</Button>
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const nextPhoto = () => {
    if (unit.photos && unit.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % unit.photos.length);
    }
  };

  const prevPhoto = () => {
    if (unit.photos && unit.photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + unit.photos.length) % unit.photos.length);
    }
  };

  const totalMonthly = unit.rentAmount + unit.chargesAmount;
  const isOccupied = unit.status === 'occupied';
  const currentPhoto = unit.photos && unit.photos.length > 0 ? unit.photos[currentPhotoIndex] : null;
  const canEdit = canAccessObject('Unit', 'edit');

  return (
    <FeatureGate
      feature="property_management"
      showUpgrade={true}
    >
      <PermissionGate
        objectType="Unit"
        action="read"
        showDenied={true}
        deniedMessage="Vous n'avez pas la permission de voir les détails de ce lot."
      >
        <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-blue-600">
          Accueil
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/units" className="hover:text-blue-600">
          Louer
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Appartement {unit.unitNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Home className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">Appartement {unit.unitNumber}</h1>
          </div>
          {unit.property && (
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <MapPin className="h-4 w-4" />
              <span>{unit.property.name}, {unit.property.city}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/units/${unit.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Link>
          </Button>
          {isOccupied && (
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Nouveau bail
            </Button>
          )}
          <Button variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo Gallery */}
          {unit.photos && unit.photos.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="relative">
                  <div className="relative h-96 w-full rounded-t-lg overflow-hidden bg-gray-100">
                    <Image
                      src={currentPhoto?.url || unit.photos[0].url}
                      alt={currentPhoto?.alt || `Photo de ${unit.unitNumber}`}
                      fill
                      className="object-cover"
                    />
                    {unit.photos.length > 1 && (
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
                  <div className="flex gap-2 p-4 bg-gray-50 rounded-b-lg">
                    {unit.photos.slice(0, 5).map((photo: any, index: number) => (
                      <div
                        key={photo.id}
                        className="relative h-20 w-28 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-600"
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
                    {unit.photos.length > 5 && (
                      <div className="relative h-20 w-28 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-100">
                        <span className="text-sm font-medium text-muted-foreground">
                          +{unit.photos.length - 5}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune photo disponible</p>
              </CardContent>
            </Card>
          )}

          {/* Characteristics */}
          <Card>
            <CardHeader>
              <CardTitle>Caractéristiques du bien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
                  <Ruler className="h-8 w-8 text-blue-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">{unit.surface || 'N/A'}</div>
                  <div className="text-sm text-muted-foreground">m²</div>
                  <div className="text-xs text-muted-foreground mt-1">Surface</div>
                </div>
                <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                  <Bed className="h-8 w-8 text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">3</div>
                  <div className="text-xs text-muted-foreground mt-1">Chambres</div>
                </div>
                <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg">
                  <Bath className="h-8 w-8 text-purple-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">2</div>
                  <div className="text-xs text-muted-foreground mt-1">Salles de bain</div>
                </div>
                <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg">
                  <Building2 className="h-8 w-8 text-orange-600 mb-2" />
                  <div className="text-2xl font-bold text-foreground">{unit.floor || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground mt-1">Étage</div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type du bien</span>
                  <span className="font-medium">Appartement</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Année de construction</span>
                  <span className="font-medium">2020</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Climatisation</span>
                  <span className="font-medium">Oui</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parking</span>
                  <span className="font-medium">1 place couverte</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DPE</span>
                  <Badge className="bg-yellow-100 text-yellow-800">Classe E</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Magnifique appartement de 3 pièces situé au cœur du quartier résidentiel des Almadies. 
                Cet appartement lumineux offre une vue imprenable sur l'océan Atlantique et dispose de 
                finitions haut de gamme. La résidence sécurisée propose une piscine, une salle de sport 
                et un service de gardiennage 24/7. Idéalement situé à proximité des commerces, restaurants 
                et plages.
              </p>
            </CardContent>
          </Card>

          {/* Equipment & Services */}
          {unit.amenities && unit.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Équipements & Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {unit.amenities.includes('wifi') && (
                    <div className="flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Wifi gratuit</span>
                    </div>
                  )}
                  {unit.amenities.includes('piscine') && (
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Piscine</span>
                    </div>
                  )}
                  {unit.amenities.includes('salle_sport') && (
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Salle de sport</span>
                    </div>
                  )}
                  {unit.amenities.includes('gardiennage') && (
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Gardiennage</span>
                    </div>
                  )}
                  {unit.amenities.includes('ascenseur') && (
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Ascenseur</span>
                    </div>
                  )}
                  {unit.amenities.includes('jardin') && (
                    <div className="flex items-center gap-2">
                      <Map className="h-5 w-5 text-blue-600" />
                      <span className="text-muted-foreground">Jardin</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {unit.property && unit.property.latitude && unit.property.longitude && (
            <Card>
              <CardHeader>
                <CardTitle>Localisation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{unit.property.address}{unit.property.city ? `, ${unit.property.city}` : ''}</span>
                  </div>
                  <UnitMap
                    latitude={unit.property.latitude}
                    longitude={unit.property.longitude}
                    unitNumber={unit.unitNumber}
                    propertyName={unit.property.name}
                    address={unit.property.address}
                    zoom={16}
                    height="400px"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle>Statut actuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Occupation</span>
                  <Badge className={isOccupied ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-foreground'}>
                    {isOccupied ? 'Occupé' : unit.status === 'vacant' ? 'Vacant' : unit.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Loyer mensuel</span>
                  <span className="font-bold">{formatCurrency(unit.rentAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Charges</span>
                  <span className="font-bold">{formatCurrency(unit.chargesAmount)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Paiement du mois</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Payé</span>
                  </div>
                </div>
                {unit.lease && unit.lease.endDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Prochain paiement le {(() => {
                      const endDate = new Date(unit.lease.endDate);
                      const nextPayment = new Date(endDate);
                      nextPayment.setMonth(nextPayment.getMonth() + 1);
                      return formatDate(nextPayment);
                    })()}
                  </p>
                )}
                <Button className="w-full mt-4" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Générer quittance
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Tenant */}
          {unit.tenant && (
            <Card>
              <CardHeader>
                <CardTitle>Locataire actuel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${unit.tenant.firstName}+${unit.tenant.lastName}`} />
                    <AvatarFallback>
                      {unit.tenant.firstName[0]}{unit.tenant.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {unit.tenant.firstName} {unit.tenant.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Locataire depuis le {formatDate(unit.tenant.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <div className="space-y-2 pt-2 border-t">
                  {unit.tenant.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{unit.tenant.phone}</span>
                    </div>
                  )}
                  {unit.tenant.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{unit.tenant.email}</span>
                    </div>
                  )}
                  {unit.lease && unit.lease.endDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Bail jusqu'au {formatDate(unit.lease.endDate)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <User className="h-4 w-4 mr-2" />
                    Profil
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Owner */}
          {unit.owner && (
            <Card>
              <CardHeader>
                <CardTitle>Propriétaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${unit.owner.name}`} />
                    <AvatarFallback>{unit.owner.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{unit.owner.name}</p>
                    <p className="text-xs text-muted-foreground">Propriétaire depuis 2020</p>
                  </div>
                </div>
                {unit.owner.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{unit.owner.phone}</span>
                  </div>
                )}
                {unit.owner.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{unit.owner.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>État des lieux</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Signaler incident</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Planifier visite</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Documents</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Payment History */}
          {unit.recentPayments && unit.recentPayments.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Historique paiements</CardTitle>
                <Link href={`/payments?unitId=${unit.id}`} className="text-sm text-blue-600 hover:text-blue-700">
                  Voir tout
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unit.recentPayments.slice(0, 3).map((payment: any) => {
                    const paymentDate = new Date(payment.paidAt || payment.createdAt);
                    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                    const month = monthNames[paymentDate.getMonth()];
                    const year = paymentDate.getFullYear();
                    return (
                      <div key={payment.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground capitalize">{month} {year}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(payment.amount)}</p>
                        </div>
                        {payment.status === 'completed' && (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
      </PermissionGate>
    </FeatureGate>
  );
}

