'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { usePageAccess } from '@/hooks/use-page-access';
import { useDataQuery } from '@/hooks/use-query';
import { AccessDenied } from '@/components/ui/access-denied';
import { AccessDeniedAction } from '@/components/ui/access-denied-action';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';

// Fetch properties from API
async function getProperties() {
  const response = await fetch('/api/properties', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }
  const data = await response.json();
  return data;
}

export default function PropertiesPage() {
  const { canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const [currentPage, setCurrentPage] = useState(1);
  const [propertyType, setPropertyType] = useState('all');
  const [city, setCity] = useState('all');
  const [occupancyRate, setOccupancyRate] = useState('all');

  const { data: properties, isLoading } = useDataQuery(['properties'], getProperties);
  const totalProperties = properties?.length || 0;
  const itemsPerPage = 6;
  const totalPages = Math.ceil(totalProperties / itemsPerPage);

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  const canCreate = canAccessObject('Property', 'create');

  const getOccupancyBadge = (rate: number) => {
    if (rate === 100) {
      return <Badge className="bg-green-500 text-white">100% occupé</Badge>;
    } else if (rate >= 80) {
      return <Badge className="bg-orange-500 text-white">{rate}% occupé</Badge>;
    } else {
      return <Badge className="bg-red-500 text-white">{rate}% occupé</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M FCFA / mois`;
    }
    return `${(amount / 1000).toFixed(0)}K FCFA / mois`;
  };

  return (
    <FeatureGate
      feature="property_management"
      showUpgrade={true}
    >
      <PermissionGate
        objectType="Property"
        action="read"
        showDenied={true}
        deniedMessage="Vous n'avez pas la permission de voir les biens immobiliers."
      >
        <div className="space-y-6 min-h-screen bg-background">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              Gestion des biens
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez votre portefeuille immobilier
            </p>
          </div>
          <PermissionGate
            objectType="Property"
            action="create"
            fallback={
              <AccessDeniedAction
                requiredPermission="Créer des biens"
                reason="permission"
                featureName="Gestion des biens"
              >
                <Button className="bg-blue-600 hover:bg-blue-700" disabled>
                  <Plus className="h-5 w-5 mr-2" />
                  Ajouter un bien
                </Button>
              </AccessDeniedAction>
            }
          >
            <Link href="/properties/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-5 w-5 mr-2" />
                Ajouter un bien
              </Button>
            </Link>
          </PermissionGate>
        </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="residence">Résidence</SelectItem>
            <SelectItem value="villa">Villa</SelectItem>
            <SelectItem value="immeuble">Immeuble</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>

        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Toutes les villes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            <SelectItem value="dakar">Dakar</SelectItem>
            <SelectItem value="thies">Thiès</SelectItem>
            <SelectItem value="saint-louis">Saint-Louis</SelectItem>
          </SelectContent>
        </Select>

        <Select value={occupancyRate} onValueChange={setOccupancyRate}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Taux d'occupation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Taux d'occupation</SelectItem>
            <SelectItem value="100">100%</SelectItem>
            <SelectItem value="80-99">80-99%</SelectItem>
            <SelectItem value="50-79">50-79%</SelectItem>
            <SelectItem value="0-49">0-49%</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Plus de filtres
        </Button>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse overflow-hidden">
              <div className="h-48 bg-gray-200"></div>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties?.map((property: {
            id: string;
            name: string;
            address: string;
            city: string | null;
            propertyType: string | null;
            totalUnits: number;
            occupiedUnits: number;
            vacantUnits: number;
            occupancyRate: number;
            monthlyIncome: number;
            imageUrl: string;
            photoUrls: string[];
            notes: string | null;
            createdAt: Date | string;
          }) => (
            <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Property Image */}
              <div className="relative h-48 w-full">
                <Image
                  src={property.imageUrl}
                  alt={property.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-3 right-3">
                  {getOccupancyBadge(property.occupancyRate)}
                </div>
              </div>

              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-foreground mb-2">{property.name}</h3>
                
                <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{property.address}</span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{property.totalUnits} Lots</span>
                    <span className="text-foreground font-medium">{property.occupiedUnits} Occupés</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Revenus mensuels</span>
                    <span className="text-foreground font-bold">{formatCurrency(property.monthlyIncome)}</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/properties/${property.id}`}>
                    Voir détails →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Affichage de {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalProperties)} sur {totalProperties} biens
        </p>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1;
            // Show first page, last page, current page, and pages around current
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={currentPage === page ? 'bg-blue-600 text-white' : ''}
                >
                  {page}
                </Button>
              );
            } else if (page === currentPage - 2 || page === currentPage + 2) {
              return <span key={page} className="px-2">...</span>;
            }
            return null;
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
      </PermissionGate>
    </FeatureGate>
  );
}

