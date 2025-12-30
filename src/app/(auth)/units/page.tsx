'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Home,
  MapPin,
  User,
  Building2,
  Upload,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  LayoutGrid,
  Eye,
  Edit,
  MoreHorizontal,
  Map,
  Maximize2,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { usePageAccess } from '@/hooks/use-page-access';
import { FeatureGate } from '@/components/features/FeatureGate';
import { useDataQuery } from '@/hooks/use-query';
import { AccessDenied } from '@/components/ui/access-denied';
import { AccessDeniedAction } from '@/components/ui/access-denied-action';
import { PageLoader } from '@/components/ui/page-loader';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const UnitsMapViewer = dynamic(() => import('@/components/ui/units-map-viewer').then(mod => ({ default: mod.UnitsMapViewer })), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">Chargement de la carte...</div>,
});

// Fetch units from API
async function getUnits() {
  const response = await fetch('/api/units', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch units');
  }
  return response.json();
}

const statusColors = {
  vacant: 'bg-gray-100 text-gray-800',
  occupied: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  reserved: 'bg-purple-100 text-purple-800',
};

const statusLabels = {
  vacant: 'Vacant',
  occupied: 'Occupé',
  maintenance: 'Maintenance',
  reserved: 'Réservé',
};

export default function UnitsPage() {
  const { canAccessObject, isLoading: isAccessLoading } = usePageAccess();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rentFilter, setRentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'large-grid'>('list');
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const itemsPerPage = 5;

  const { data: units, isLoading } = useDataQuery(['units'], getUnits);

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }

  const canCreate = canAccessObject('Unit', 'create');

  const filteredUnits = units?.filter((unit: any) => {
    const matchesSearch = 
      unit.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.propertyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (unit.tenantName && unit.tenantName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesCity = cityFilter === 'all' || (unit.propertyCity && unit.propertyCity.toLowerCase().includes(cityFilter.toLowerCase()));
    const matchesType = typeFilter === 'all'; // Type would need to be added to units
    const matchesRent = rentFilter === 'all'; // Rent filter logic would go here

    return matchesSearch && matchesStatus && matchesCity && matchesType && matchesRent;
  }) || [];

  // Sort units
  const sortedUnits = [...filteredUnits].sort((a: any, b: any) => {
    if (sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedUnits.length / itemsPerPage);
  const paginatedUnits = sortedUnits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const getUnitTypeIcon = (propertyName: string) => {
    if (propertyName?.toLowerCase().includes('villa')) return Home;
    if (propertyName?.toLowerCase().includes('commerce') || propertyName?.toLowerCase().includes('bureau')) return Building2;
    return Building2;
  };

  const getPaymentStatus = (unit: any) => {
    if (unit.paymentStatus === 'paid') {
      return { label: 'A jour', color: 'text-green-600', icon: CheckCircle2 };
    } else if (unit.paymentStatus === 'unpaid') {
      return { label: '15j retard', color: 'text-red-600', icon: AlertCircle };
    }
    return { label: 'A jour', color: 'text-green-600', icon: CheckCircle2 };
  };

  // Count by status
  const occupiedCount = filteredUnits.filter((u: any) => u.status === 'occupied').length;
  const vacantCount = filteredUnits.filter((u: any) => u.status === 'vacant').length;
  const unpaidCount = 0; // Would need to calculate from payments

  return (
    <FeatureGate
      feature="property_management"
      showUpgrade={true}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Liste des lots</h1>
            <p className="text-gray-600 mt-1">Gérez et visualisez tous vos lots immobiliers</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <ChevronDown className="h-4 w-4 mr-2" />
              Filtres avancés
            </Button>
            <Button variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
            {canCreate ? (
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="/units/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau lot
                </Link>
              </Button>
            ) : (
              <AccessDeniedAction
                requiredPermission="Créer des lots"
                reason="permission"
                featureName="Gestion des lots"
              >
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau lot
                </Button>
              </AccessDeniedAction>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Référence, adresse."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Dropdowns */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ville" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les villes</SelectItem>
                    <SelectItem value="dakar">Dakar</SelectItem>
                    <SelectItem value="thies">Thiès</SelectItem>
                    <SelectItem value="saint-louis">Saint-Louis</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="occupied">Occupé</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="reserved">Réservé</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="apartment">Appartement</SelectItem>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="office">Bureau</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={rentFilter} onValueChange={setRentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loyer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les montants</SelectItem>
                    <SelectItem value="0-300000">0 - 300,000 FCFA</SelectItem>
                    <SelectItem value="300000-600000">300,000 - 600,000 FCFA</SelectItem>
                    <SelectItem value="600000-1000000">600,000 - 1,000,000 FCFA</SelectItem>
                    <SelectItem value="1000000+">1,000,000+ FCFA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Affichage:</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 p-0"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'large-grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('large-grid')}
                      className="h-8 w-8 p-0"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {(searchTerm || statusFilter !== 'all' || cityFilter !== 'all' || typeFilter !== 'all' || rentFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setCityFilter('all');
                      setTypeFilter('all');
                      setRentFilter('all');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary and Sort */}
        <div className="flex items-center justify-between">
          <p className="text-gray-700 font-medium">
            {filteredUnits.length} lots trouvés
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Trier par:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date d'ajout</SelectItem>
                <SelectItem value="rent">Loyer</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
                <SelectItem value="name">Nom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Units Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUnits.size > 0 && selectedUnits.size === paginatedUnits.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUnits(new Set(paginatedUnits.map((u: any) => u.id)));
                        } else {
                          setSelectedUnits(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>LOT</TableHead>
                  <TableHead>LOCATAIRE</TableHead>
                  <TableHead>LOYER</TableHead>
                  <TableHead>STATUT</TableHead>
                  <TableHead className="text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Aucun lot trouvé</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUnits.map((unit: any) => {
                    const TypeIcon = getUnitTypeIcon(unit.propertyName);
                    const paymentStatus = getPaymentStatus(unit);
                    const PaymentIcon = paymentStatus.icon;

                    return (
                      <TableRow key={unit.id} className="hover:bg-gray-50">
                        <TableCell>
                          <Checkbox
                            checked={selectedUnits.has(unit.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedUnits);
                              if (checked) {
                                newSelected.add(unit.id);
                              } else {
                                newSelected.delete(unit.id);
                              }
                              setSelectedUnits(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">
                                LOT-{unit.unitNumber}
                              </div>
                              <div className="text-sm text-gray-500">
                                {(() => {
                                  // Try to extract type and location from property name
                                  const propertyName = unit.propertyName || '';
                                  if (propertyName.toLowerCase().includes('appt') || propertyName.toLowerCase().includes('appartement')) {
                                    return `Appt T3, ${unit.propertyCity || 'N/A'}`;
                                  } else if (propertyName.toLowerCase().includes('villa')) {
                                    return `Villa F4, ${unit.propertyCity || 'N/A'}`;
                                  } else if (propertyName.toLowerCase().includes('commerce')) {
                                    return `Commerce, ${unit.propertyCity || 'N/A'}`;
                                  } else if (propertyName.toLowerCase().includes('bureau')) {
                                    return `Bureau ${unit.surface || ''}m², ${unit.propertyCity || 'N/A'}`;
                                  }
                                  return `${propertyName}, ${unit.propertyCity || 'N/A'}`;
                                })()}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {unit.tenantName ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={`https://ui-avatars.com/api/?name=${unit.tenantName}`}
                                />
                                <AvatarFallback>
                                  {unit.tenantName.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900">{unit.tenantName}</div>
                                {unit.tenantPhone && (
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {unit.tenantPhone}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Vacant</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatCurrency(unit.rentAmount)}
                            </div>
                            <div className={`text-xs flex items-center gap-1 ${paymentStatus.color}`}>
                              <PaymentIcon className="h-3 w-3" />
                              {paymentStatus.label}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              unit.status === 'occupied'
                                ? 'bg-green-100 text-green-800'
                                : unit.status === 'vacant'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {statusLabels[unit.status as keyof typeof statusLabels] || unit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/units/${unit.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/units/${unit.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Affichage de {(currentPage - 1) * itemsPerPage + 1} à{' '}
            {Math.min(currentPage * itemsPerPage, filteredUnits.length)} sur{' '}
            {filteredUnits.length} lots
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
            {[...Array(Math.min(totalPages, 3))].map((_, i) => {
              const page = i + 1;
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
            })}
            {totalPages > 3 && <span className="px-2">...</span>}
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

      {/* Right Sidebar - Map */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Carte des lots
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Map */}
            {selectedUnits.size > 0 ? (
              <UnitsMapViewer
                units={filteredUnits
                  .filter((u: any) => selectedUnits.has(u.id))
                  .map((u: any) => ({
                    id: u.id,
                    unitNumber: u.unitNumber,
                    propertyName: u.propertyName || 'Bien inconnu',
                    address: u.propertyAddress || 'Adresse non disponible',
                    city: u.propertyCity || undefined,
                    latitude: u.propertyLatitude ? parseFloat(u.propertyLatitude) : 0,
                    longitude: u.propertyLongitude ? parseFloat(u.propertyLongitude) : 0,
                  }))
                  .filter((u: any) => u.latitude !== 0 && u.longitude !== 0)}
                height="400px"
              />
            ) : (
              <div className="relative h-96 w-full rounded-lg overflow-hidden border bg-gray-100">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Sélectionnez des lots pour voir la carte</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Cochez les lots dans le tableau pour afficher leurs emplacements
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Maximize2 className="h-4 w-4" />
              Agrandir le plan
            </Link>

            {/* Legend */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-gray-700">Occupé ({occupiedCount})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-gray-700">Vacant ({vacantCount})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-gray-700">Impayé ({unpaidCount})</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 pt-2">
              Données cartographiques ©2005 Conditions d'utilisation
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </FeatureGate>
  );
}
