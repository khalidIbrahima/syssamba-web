'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CreditCard,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Payment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: string;
  transactionId: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  gatewayResponse: any;
  failureReason: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  refundedAmount: number | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  planName: string | null;
  subscriptionStatus: string | null;
}

interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Fetch payment history
async function getPaymentHistory(params?: {
  status?: string;
  paymentMethod?: string;
  limit?: number;
  offset?: number;
}): Promise<PaymentsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.paymentMethod) queryParams.append('payment_method', params.paymentMethod);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const response = await fetch(`/api/organization/payments?${queryParams.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch payment history');
  }
  return response.json();
}

export default function PaymentsPage() {
  const { canPerformAction, canAccessObject, isLoading: isAccessLoading } = useAccess();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const { data, isLoading, error, refetch } = useDataQuery<PaymentsResponse>(
    ['payment-history', statusFilter, paymentMethodFilter],
    () => getPaymentHistory({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
      limit: 50,
      offset: 0,
    })
  );

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Vérification des accès..." />;
  }

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canPerformAction('canViewSettings') && !canAccessObject('Organization', 'edit')) {
    return (
      <AccessDenied
        featureName="Historique des paiements"
        requiredPermission="canViewSettings"
        icon="lock"
      />
    );
  }

  const payments = data?.payments || [];
  const pagination = data?.pagination;

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
    return format(parseISO(dateString), 'dd MMM yyyy à HH:mm', { locale: fr });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), 'dd MMM yyyy', { locale: fr });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: any }> = {
      completed: {
        label: 'Payé',
        className: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle2,
      },
      pending: {
        label: 'En attente',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Clock,
      },
      processing: {
        label: 'En traitement',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: RefreshCw,
      },
      failed: {
        label: 'Échoué',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: XCircle,
      },
      refunded: {
        label: 'Remboursé',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: RotateCcw,
      },
      disputed: {
        label: 'En litige',
        className: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: AlertCircle,
      },
    };

    const variant = variants[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: AlertCircle,
    };

    const Icon = variant.icon;

    return (
      <Badge className={cn('flex items-center gap-1', variant.className)}>
        <Icon className="h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      stripe: 'Carte bancaire (Stripe)',
      paypal: 'PayPal',
      wave: 'Wave',
      orange_money: 'Orange Money',
    };
    return labels[method] || method;
  };

  const canRefund = (payment: Payment) => {
    return payment.status === 'completed' && 
           (!payment.refundedAmount || payment.refundedAmount < payment.amount);
  };

  const handleRefundClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundReason('');
    setRefundAmount('');
    setRefundDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    if (!refundReason.trim()) {
      toast.error('Veuillez indiquer la raison du remboursement');
      return;
    }

    setIsProcessingRefund(true);
    try {
      const refundData: any = {
        reason: refundReason,
      };

      // If partial refund amount is specified
      if (refundAmount && parseFloat(refundAmount) > 0) {
        const amount = parseFloat(refundAmount);
        const remainingAmount = selectedPayment.amount - (selectedPayment.refundedAmount || 0);
        
        if (amount > remainingAmount) {
          toast.error(`Le montant ne peut pas dépasser ${formatCurrency(remainingAmount)}`);
          setIsProcessingRefund(false);
          return;
        }
        
        refundData.amount = amount;
      }

      const response = await fetch(`/api/organization/payments/${selectedPayment.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process refund');
      }

      const result = await response.json();
      toast.success(result.message || 'Remboursement traité avec succès');
      setRefundDialogOpen(false);
      setSelectedPayment(null);
      setRefundReason('');
      setRefundAmount('');
      refetch();
    } catch (error: any) {
      console.error('Refund error:', error);
      toast.error(error.message || 'Erreur lors du traitement du remboursement');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const remainingRefundableAmount = selectedPayment
    ? selectedPayment.amount - (selectedPayment.refundedAmount || 0)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 min-h-screen bg-background">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-700">Erreur lors du chargement de l'historique des paiements</p>
            <Button onClick={() => refetch()} className="mt-4">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-background">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historique des paiements</h1>
        <p className="text-muted-foreground">Consultez et gérez tous vos paiements d'abonnement</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status-filter">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="completed">Payé</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="processing">En traitement</SelectItem>
                  <SelectItem value="failed">Échoué</SelectItem>
                  <SelectItem value="refunded">Remboursé</SelectItem>
                  <SelectItem value="disputed">En litige</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="method-filter">Méthode de paiement</Label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger id="method-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les méthodes</SelectItem>
                  <SelectItem value="stripe">Carte bancaire (Stripe)</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="wave">Wave</SelectItem>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Paiements</CardTitle>
              <CardDescription>
                {pagination?.total || 0} paiement{pagination?.total !== 1 ? 's' : ''} au total
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun paiement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDateShort(payment.createdAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(payment.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{payment.planName || 'N/A'}</span>
                          {payment.subscriptionStatus && (
                            <Badge variant="outline" className="text-xs w-fit mt-1">
                              {payment.subscriptionStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{formatDateShort(payment.billingPeriodStart)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{formatDateShort(payment.billingPeriodEnd)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{getPaymentMethodLabel(payment.paymentMethod)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatCurrency(payment.amount)}</span>
                          {payment.refundedAmount && payment.refundedAmount > 0 && (
                            <span className="text-xs text-red-600">
                              Remboursé: {formatCurrency(payment.refundedAmount)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.transactionId ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {payment.transactionId.substring(0, 12)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canRefund(payment) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRefundClick(payment)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Rembourser
                            </Button>
                          )}
                          {payment.status === 'completed' && (
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un remboursement</DialogTitle>
            <DialogDescription>
              {selectedPayment && (
                <>
                  Paiement de {formatCurrency(selectedPayment.amount)} effectué le{' '}
                  {formatDateShort(selectedPayment.createdAt)}
                  {selectedPayment.refundedAmount && selectedPayment.refundedAmount > 0 && (
                    <span className="block mt-2 text-orange-600">
                      Déjà remboursé: {formatCurrency(selectedPayment.refundedAmount)}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="refund-reason">Raison du remboursement *</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ex: Demande client, erreur de facturation, etc."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="refund-amount">
                Montant (optionnel - laisser vide pour remboursement complet)
              </Label>
              <Input
                id="refund-amount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Max: ${formatCurrency(remainingRefundableAmount)}`}
                min={0}
                max={remainingRefundableAmount}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Montant maximum remboursable: {formatCurrency(remainingRefundableAmount)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleRefund}
              disabled={isProcessingRefund || !refundReason.trim()}
            >
              {isProcessingRefund ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                'Confirmer le remboursement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

