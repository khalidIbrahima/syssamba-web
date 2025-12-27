'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Edit,
  User,
  Building2,
  Home,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Phone,
  Mail,
  MapPin,
  Receipt,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Fetch payment details from API
async function getPaymentDetails(id: string) {
  const response = await fetch(`/api/payments/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch payment details');
  }
  return response.json();
}

export default function PaymentDetailsPage() {
  const params = useParams();
  const paymentId = params.id as string;
  const { canAccessFeature, canAccessObject } = useAccess();

  const { data: payment, isLoading } = useDataQuery(
    ['payment-details', paymentId],
    () => getPaymentDetails(paymentId)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  // User needs either canViewAllPayments OR canRead access
  const hasViewAllAccess = canAccessFeature('payments_manual_entry', 'canViewAllPayments');
  const hasReadAccess = canAccessObject('Payment', 'read');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Détails du paiement"
        requiredPlan="starter"
        icon="lock"
      />
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), 'dd MMMM yyyy à HH:mm', { locale: fr });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: fr });
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
      case 'refunded':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <XCircle className="h-3 w-3 mr-1" />
            Remboursé
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

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

  if (!payment) {
    return (
      <div className="text-center py-12">
        <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Paiement non trouvé
        </h3>
        <Link href="/payments">
          <Button>Retour aux paiements</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/payments" className="hover:text-blue-600">
          Paiements
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">Détails du paiement</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Détails du paiement</h1>
          <p className="text-gray-600">Informations complètes sur le paiement</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          {payment.status === 'pending' && (
            <Button size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      {/* Payment Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Payment Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Résumé du paiement</CardTitle>
                {getStatusBadge(payment.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Montant</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
                {payment.feeAmount > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Frais</p>
                    <p className="text-lg font-semibold text-gray-700">
                      {formatCurrency(payment.feeAmount)}
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(payment.amount + payment.feeAmount)}
                  </p>
                </div>
              </div>
              {payment.transactionId && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-1">Référence transaction</p>
                  <p className="text-sm font-mono text-gray-900">{payment.transactionId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Date de création</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
                {payment.paidAt && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Date de paiement</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(payment.paidAt)}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Méthode de paiement</p>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">
                    {payment.paymentMethod?.name || 'N/A'}
                  </p>
                  {payment.paymentMethod?.provider && (
                    <Badge variant="outline" className="text-xs">
                      {payment.paymentMethod.provider}
                    </Badge>
                  )}
                </div>
              </div>
              {payment.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-sm text-gray-900">{payment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lease Information */}
          {payment.lease && (
            <Card>
              <CardHeader>
                <CardTitle>Informations du bail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Date de début</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateShort(payment.lease.startDate)}
                    </p>
                  </div>
                  {payment.lease.endDate && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Date de fin</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateShort(payment.lease.endDate)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Loyer</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.lease.rentAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Charges</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.lease.chargesAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Dépôt de garantie</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.lease.depositAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tenant Info */}
          <Card>
            <CardHeader>
              <CardTitle>Locataire</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarImage src={undefined} />
                  <AvatarFallback>
                    {payment.tenant?.firstName?.[0] || ''}{payment.tenant?.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900">
                    {payment.tenant?.firstName} {payment.tenant?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{payment.tenant?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {payment.tenant?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{payment.tenant.phone}</span>
                  </div>
                )}
                {payment.tenant?.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{payment.tenant.email}</span>
                  </div>
                )}
                {payment.tenant?.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{payment.tenant.address}</span>
                  </div>
                )}
              </div>
              <Link href={`/tenants/${payment.tenant?.id}`}>
                <Button variant="outline" className="w-full mt-4" size="sm">
                  Voir le profil
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Propriété</p>
                  <p className="font-medium text-gray-900">{payment.property?.name || 'N/A'}</p>
                  {payment.property?.address && (
                    <p className="text-sm text-gray-600">{payment.property.address}</p>
                  )}
                  {payment.property?.city && (
                    <p className="text-sm text-gray-600">{payment.property.city}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Lot</p>
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-gray-400" />
                    <p className="font-medium text-gray-900">
                      {payment.unit?.unitNumber || 'N/A'}
                      {payment.unit?.floor && ` - Étage ${payment.unit.floor}`}
                    </p>
                  </div>
                  {payment.unit?.surface && (
                    <p className="text-sm text-gray-600 mt-1">
                      {payment.unit.surface} m²
                    </p>
                  )}
                </div>
                <Link href={`/properties/${payment.property?.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    Voir le bien
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Receipt className="h-4 w-4 mr-2" />
                Générer un reçu
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Voir le contrat
              </Button>
              {payment.status === 'pending' && (
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier le paiement
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

