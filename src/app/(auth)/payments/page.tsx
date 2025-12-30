'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Filter,
  Download,
  Plus,
  ChevronDown,
  Eye,
  Play,
  Edit,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useTabPermission } from '@/hooks/use-tab-permission';
import { useDataQuery } from '@/hooks/use-query';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

// Fetch owner transfers data
async function getOwnerTransfers(params: {
  period?: string;
  status?: string;
  ownerId?: string;
  minAmount?: number;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.append('period', params.period);
  if (params.status) searchParams.append('status', params.status);
  if (params.ownerId) searchParams.append('ownerId', params.ownerId);
  if (params.minAmount) searchParams.append('minAmount', params.minAmount.toString());
  if (params.page) searchParams.append('page', params.page.toString());

  const response = await fetch(`/api/payments/owner-transfers?${searchParams.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch owner transfers');
  }
  return response.json();
}

// Fetch tenant payments data
async function getTenantPayments(params: {
  status?: string;
  tenantId?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.append('status', params.status);
  if (params.tenantId) searchParams.append('tenantId', params.tenantId);
  if (params.page) searchParams.append('page', params.page.toString());

  const response = await fetch(`/api/payments?${searchParams.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch tenant payments');
  }
  return response.json();
}

export default function PaymentsPage() {
  const { canAccessFeature, isLoading: isAccessLoading } = usePageAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('tenant-payments');

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check tab permissions
  const canAccessTenantPayments = useTabPermission({
    tab: 'tenant-payments',
    permission: 'canViewAllPayments',
    objectType: 'Payment',
    objectAction: 'read',
  });

  const canAccessOwnerTransfers = useTabPermission({
    tab: 'owner-transfers',
    permission: 'canViewAllPayments',
    objectType: 'Payment',
    objectAction: 'read',
    // Optional: Can require additional feature for owner transfers
    // featureKey: 'payments_all_methods',
  });

  // Sync tab with URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'owner-transfers' && canAccessOwnerTransfers) {
      setActiveTab(tab);
    } else if (tab === 'tenant-payments' && canAccessTenantPayments) {
      setActiveTab(tab);
    } else if (!canAccessTenantPayments && canAccessOwnerTransfers) {
      // If tenant payments not accessible but owner transfers is, default to owner transfers
      setActiveTab('owner-transfers');
    } else if (canAccessTenantPayments) {
      // Default to tenant payments if accessible
      setActiveTab('tenant-payments');
    }
  }, [searchParams, canAccessTenantPayments, canAccessOwnerTransfers]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/payments?${params.toString()}`);
  };
  
  // Owner transfers filters
  const [period, setPeriod] = useState('current-month');
  const [transferStatus, setTransferStatus] = useState('all');
  const [ownerId, setOwnerId] = useState('all');
  const [minAmount, setMinAmount] = useState(0);
  const [transferPage, setTransferPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState('30j');

  // Tenant payments filters
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [tenantId, setTenantId] = useState('all');
  const [paymentPage, setPaymentPage] = useState(1);

  const { data: transfersData, isLoading: transfersLoading, refetch: refetchTransfers } = useDataQuery(
    ['owner-transfers', period, transferStatus, ownerId, minAmount.toString(), transferPage.toString()],
    () => getOwnerTransfers({ period, status: transferStatus, ownerId, minAmount, page: transferPage }),
    { enabled: activeTab === 'owner-transfers' }
  );

  const { data: paymentsData, isLoading: paymentsLoading, refetch: refetchPayments } = useDataQuery(
    ['tenant-payments', paymentStatus, tenantId, paymentPage.toString()],
    () => getTenantPayments({ status: paymentStatus, tenantId, page: paymentPage }),
    { enabled: activeTab === 'tenant-payments' }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd MMM yyyy', { locale: fr });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Payé
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Échoué
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Calendar className="h-3 w-3 mr-1" />
            Programmé
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleExport = () => {
    toast.info('Export en cours de préparation...');
  };

  const handleNewPayment = () => {
    toast.info('Création d\'un nouveau paiement...');
  };

  const handleNewTransfer = () => {
    toast.info('Création d\'un nouveau virement...');
  };


  // Owner transfers data
  const transfersStats = transfersData?.stats || {
    totalToTransfer: 45750000,
    transfersMade: 38200000,
    pending: 7550000,
    activeOwners: 24,
  };
  const transfers = transfersData?.transfers || [];
  const evolution = transfersData?.evolution || [];
  const transfersPagination = transfersData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Tenant payments data
  const paymentsStats = paymentsData?.stats || {
    totalAmount: 0,
    completedAmount: 0,
    pendingAmount: 0,
    failedAmount: 0,
    totalFees: 0,
    completedCount: 0,
    pendingCount: 0,
    failedCount: 0,
  };
  const payments = paymentsData?.payments || [];
  const paymentsPagination = paymentsData?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Format evolution data for chart
  const chartData = evolution.map((item: any) => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: fr }),
    completed: item.completed / 1000000,
    scheduled: item.scheduled / 1000000,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600">Gestion des paiements locataires et virements propriétaires</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'tenant-payments' ? (
            <Button size="sm" onClick={handleNewPayment}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau paiement
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
              <Button size="sm" onClick={handleNewTransfer}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau virement
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tenant-payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Paiements locataires
          </TabsTrigger>
          <TabsTrigger value="owner-transfers" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Virements propriétaires
          </TabsTrigger>
        </TabsList>

        {/* Tenant Payments Tab */}
        <TabsContent value="tenant-payments" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total reçu</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsLoading ? '...' : formatCurrency(paymentsStats.completedAmount)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Payés</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsLoading ? '...' : paymentsStats.completedCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">En attente</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsLoading ? '...' : paymentsStats.pendingCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Échoués</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentsLoading ? '...' : paymentsStats.failedCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentStatus">Statut</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger id="paymentStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="completed">Payé</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="failed">Échoué</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantFilter">Locataire</Label>
                  <Select value={tenantId} onValueChange={setTenantId}>
                    <SelectTrigger id="tenantFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les locataires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => refetchPayments()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualiser
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Paiements récents</CardTitle>
              <CardDescription>Historique des paiements des locataires</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : payments.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>LOCATAIRE</TableHead>
                        <TableHead>BIEN</TableHead>
                        <TableHead>MONTANT</TableHead>
                        <TableHead>MÉTHODE</TableHead>
                        <TableHead>DATE</TableHead>
                        <TableHead>STATUT</TableHead>
                        <TableHead className="text-right">ACTIONS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={payment.tenant?.avatar || undefined} />
                                <AvatarFallback>
                                  {payment.tenant?.firstName?.[0]}{payment.tenant?.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {payment.tenant?.firstName} {payment.tenant?.lastName}
                                </p>
                                <p className="text-sm text-gray-600">{payment.tenant?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.property?.name || 'N/A'}</p>
                              <p className="text-sm text-gray-600">{payment.unit?.unitNumber || 'N/A'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{formatCurrency(payment.amount)}</p>
                              {payment.feeAmount > 0 && (
                                <p className="text-xs text-gray-500">
                                  Frais: {formatCurrency(payment.feeAmount)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{payment.paymentMethod?.name || 'N/A'}</p>
                          </TableCell>
                          <TableCell>
                            {payment.paidAt ? formatDate(payment.paidAt) : formatDate(payment.createdAt)}
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/payments/${payment.id}`}>
                                <Button variant="ghost" size="icon" title="Voir les détails">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {payment.status === 'pending' && (
                                <Button variant="ghost" size="icon" title="Modifier">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      {paymentsPagination.total > 0 ? (
                        <>
                          Affichage de {(paymentPage - 1) * (paymentsPagination.limit || 10) + 1} à{' '}
                          {Math.min(paymentPage * (paymentsPagination.limit || 10), paymentsPagination.total)} sur{' '}
                          {paymentsPagination.total} paiement{paymentsPagination.total > 1 ? 's' : ''}
                        </>
                      ) : (
                        'Aucun paiement'
                      )}
                    </p>
                    {paymentsPagination.totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                          disabled={paymentPage === 1 || paymentsLoading}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const totalPages = paymentsPagination.totalPages;
                            const currentPage = paymentPage;
                            const pages: (number | string)[] = [];
                            
                            if (totalPages <= 7) {
                              // Afficher toutes les pages si <= 7
                              for (let i = 1; i <= totalPages; i++) {
                                pages.push(i);
                              }
                            } else {
                              // Toujours afficher la première page
                              pages.push(1);
                              
                              if (currentPage > 3) {
                                pages.push('...');
                              }
                              
                              // Afficher les pages autour de la page actuelle
                              const start = Math.max(2, currentPage - 1);
                              const end = Math.min(totalPages - 1, currentPage + 1);
                              
                              for (let i = start; i <= end; i++) {
                                if (i !== 1 && i !== totalPages) {
                                  pages.push(i);
                                }
                              }
                              
                              if (currentPage < totalPages - 2) {
                                pages.push('...');
                              }
                              
                              // Toujours afficher la dernière page
                              pages.push(totalPages);
                            }
                            
                            return pages.map((page, index) => {
                              if (page === '...') {
                                return (
                                  <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                                    ...
                                  </span>
                                );
                              }
                              
                              const pageNum = page as number;
                              return (
                                <Button
                                  key={pageNum}
                                  variant={paymentPage === pageNum ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setPaymentPage(pageNum)}
                                  disabled={paymentsLoading}
                                  className="min-w-[2.5rem]"
                                >
                                  {pageNum}
                                </Button>
                              );
                            });
                          })()}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentPage((p) => Math.min(paymentsPagination.totalPages, p + 1))}
                          disabled={paymentPage === paymentsPagination.totalPages || paymentsLoading}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucun paiement
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Aucun paiement trouvé pour les critères sélectionnés.
                  </p>
                  <Button onClick={handleNewPayment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau paiement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Owner Transfers Tab */}
        {canAccessOwnerTransfers && (
          <TabsContent value="owner-transfers" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total à virer</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {transfersLoading ? '...' : formatCurrency(transfersStats.totalToTransfer)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Virements effectués</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {transfersLoading ? '...' : formatCurrency(transfersStats.transfersMade)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">En attente</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {transfersLoading ? '...' : formatCurrency(transfersStats.pending)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Propriétaires</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {transfersLoading ? '...' : `${transfersStats.activeOwners} actifs`}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period">Période</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger id="period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current-month">Mois en cours</SelectItem>
                      <SelectItem value="last-month">Mois dernier</SelectItem>
                      <SelectItem value="2024-12">Décembre 2024</SelectItem>
                      <SelectItem value="2024-11">Novembre 2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transferStatus">Statut</Label>
                  <Select value={transferStatus} onValueChange={setTransferStatus}>
                    <SelectTrigger id="transferStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="completed">Effectué</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="scheduled">Programmé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerFilter">Propriétaire</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="ownerFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les propriétaires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minAmount">Montant min</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    value={minAmount.toString()}
                    onChange={(e) => setMinAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0 FCFA"
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => refetchTransfers()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualiser
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Évolution des virements</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={chartPeriod === '7j' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartPeriod('7j')}
                  >
                    7j
                  </Button>
                  <Button
                    variant={chartPeriod === '30j' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartPeriod('30j')}
                  >
                    30j
                  </Button>
                  <Button
                    variant={chartPeriod === '3m' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartPeriod('3m')}
                  >
                    3m
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Virements effectués"
                    />
                    <Line
                      type="monotone"
                      dataKey="scheduled"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Virements programmés"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Derniers virements</CardTitle>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : transfers.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PROPRIÉTAIRE</TableHead>
                        <TableHead>BIEN</TableHead>
                        <TableHead>MONTANT</TableHead>
                        <TableHead>DATE PRÉVUE</TableHead>
                        <TableHead>STATUT</TableHead>
                        <TableHead className="text-right">ACTIONS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((transfer: any) => (
                        <TableRow key={transfer.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={transfer.owner.avatar} />
                                <AvatarFallback>
                                  {transfer.owner.firstName?.[0] || ''}{transfer.owner.lastName?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900">
                                  {transfer.owner.firstName || ''} {transfer.owner.lastName || ''}
                                </p>
                                {transfer.owner.email && (
                                  <p className="text-sm text-gray-600 truncate">{transfer.owner.email}</p>
                                )}
                                {transfer.owner.phone && (
                                  <p className="text-sm text-gray-500">{transfer.owner.phone}</p>
                                )}
                                {!transfer.owner.email && !transfer.owner.phone && (
                                  <p className="text-xs text-gray-400">Informations de contact non disponibles</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{transfer.property.name || 'N/A'}</p>
                              {transfer.property.unit && transfer.property.unit !== 'N/A' && (
                                <p className="text-sm text-gray-600">Lot: {transfer.property.unit}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(transfer.amount)}
                          </TableCell>
                          <TableCell>{formatDate(transfer.dueDate)}</TableCell>
                          <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {transfer.paymentId && (
                                <Link href={`/payments/${transfer.paymentId}`}>
                                  <Button variant="ghost" size="icon" title="Voir le paiement source">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                              {transfer.status === 'completed' && (
                                <Button variant="ghost" size="icon" title="Télécharger">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {transfer.status === 'pending' && (
                                <>
                                  <Button variant="ghost" size="icon" title="Effectuer le virement">
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Modifier">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {transfer.status === 'scheduled' && (
                                <>
                                  <Button variant="ghost" size="icon" title="Modifier">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Annuler">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Affichage de {(transferPage - 1) * 10 + 1} à {Math.min(transferPage * 10, transfersPagination.total)} sur{' '}
                      {transfersPagination.total} virements
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransferPage((p) => Math.max(1, p - 1))}
                        disabled={transferPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                      </Button>
                      {Array.from({ length: transfersPagination.totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={transferPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTransferPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransferPage((p) => Math.min(transfersPagination.totalPages, p + 1))}
                        disabled={transferPage === transfersPagination.totalPages}
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucun virement
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Aucun virement trouvé pour les critères sélectionnés.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
