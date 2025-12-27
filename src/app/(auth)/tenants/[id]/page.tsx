'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  ChevronRight,
  Printer,
  Edit,
  Star,
  Phone,
  Mail,
  Briefcase,
  Calendar,
  TrendingUp,
  Clock,
  Handshake,
  MessageSquare,
  Send,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Home,
  DollarSign,
  CheckSquare,
  Plus,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TenantMessages } from '@/components/tenants/tenant-messages';

// Fetch tenant details from API
async function getTenantDetails(id: string) {
  const response = await fetch(`/api/tenants/${id}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch tenant details');
  }
  return response.json();
}

export default function TenantProfilePage() {
  const params = useParams();
  const tenantId = params.id as string;
  const { canAccessFeature, canAccessObject } = useAccess();

  const { data: tenant, isLoading } = useDataQuery(
    ['tenant-profile', tenantId],
    () => getTenantDetails(tenantId)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  // User needs either canViewAllTenants OR canRead access
  const hasViewAllAccess = canAccessFeature('tenants_basic', 'canViewAllTenants');
  const hasReadAccess = canAccessObject('Tenant', 'read');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Détails du locataire"
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

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Locataire non trouvé
        </h3>
        <Link href="/tenants">
          <Button>Retour aux locataires</Button>
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy', { locale: fr });
  };

  const getPaymentStatus = (payment: any) => {
    if (payment.status === 'completed') {
      const paidDate = payment.paidAt ? new Date(payment.paidAt) : null;
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() - 1);
      
      if (paidDate && paidDate <= dueDate) {
        return { label: 'A temps', color: 'text-green-600', bgColor: 'bg-green-50', dotColor: 'bg-green-500' };
      } else {
        const daysLate = paidDate ? Math.floor((dueDate.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        if (daysLate > 0) {
          return { label: `Retard ${daysLate}j`, color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' };
        }
        return { label: 'A temps', color: 'text-green-600', bgColor: 'bg-green-50', dotColor: 'bg-green-500' };
      }
    }
    return { label: 'En attente', color: 'text-gray-600', bgColor: 'bg-gray-50', dotColor: 'bg-gray-500' };
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else if (rating >= i - 0.5) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />);
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-gray-300" />);
      }
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  // Calculate CIB score based on real payment history from database
  const calculateCIBScore = () => {
    if (!tenant.paymentHistory || tenant.paymentHistory.length === 0) {
      return { score: 0, label: 'Non évalué', paymentHistory: 0, incomeStability: 0, debtRatio: 0 };
    }
    
    // Calculate payment history score from real data
    const completedPayments = tenant.paymentHistory.filter((p: any) => p.status === 'completed' || p.status === 'paid').length;
    const totalPayments = tenant.paymentHistory.length;
    const paymentHistoryScore = totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0;
    
    // Calculate income stability based on payment consistency (real data)
    // If payments are regular (similar amounts), stability is higher
    const paymentAmounts = tenant.paymentHistory
      .filter((p: any) => p.amount && p.amount > 0)
      .map((p: any) => p.amount);
    
    let incomeStability = 50; // Default
    if (paymentAmounts.length > 1) {
      const avgAmount = paymentAmounts.reduce((a: number, b: number) => a + b, 0) / paymentAmounts.length;
      const variance = paymentAmounts.reduce((sum: number, amount: number) => sum + Math.pow(amount - avgAmount, 2), 0) / paymentAmounts.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avgAmount > 0 ? (stdDev / avgAmount) * 100 : 100;
      // Lower variation = higher stability (max 100, min 0)
      incomeStability = Math.max(0, Math.min(100, 100 - coefficientOfVariation));
    } else if (paymentAmounts.length === 1) {
      incomeStability = 75; // Single payment, moderate stability
    }
    
    // Calculate debt ratio based on rent amount vs payments (real data)
    let debtRatio = 0;
    if (tenant.rentAmount && tenant.rentAmount > 0) {
      const totalPaid = paymentAmounts.reduce((a: number, b: number) => a + b, 0);
      const expectedTotal = tenant.rentAmount * totalPayments;
      // If paid amount is less than expected, debt ratio increases
      debtRatio = expectedTotal > 0 ? Math.min(100, (1 - (totalPaid / expectedTotal)) * 100) : 0;
    }
    
    const score = Math.round((paymentHistoryScore * 0.4) + (incomeStability * 0.3) + ((100 - debtRatio) * 0.3));
    
    let label = 'Excellent';
    if (score < 600) label = 'Faible';
    else if (score < 700) label = 'Moyen';
    else if (score < 800) label = 'Bon';
    
    return { score, label, paymentHistory: Math.round(paymentHistoryScore), incomeStability, debtRatio };
  };

  const cibScore = calculateCIBScore();

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/tenants" className="hover:text-blue-600">
            Locataires
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">
            {tenant.firstName} {tenant.lastName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
            <Link href={`/tenants/${tenant.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tenant Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profil Locataire</CardTitle>
              <CardDescription>Informations complètes et gestion du locataire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={`https://ui-avatars.com/api/?name=${tenant.firstName}+${tenant.lastName}&size=80`}
                  />
                  <AvatarFallback className="text-lg">
                    {tenant.firstName[0]}{tenant.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {tenant.firstName} {tenant.lastName}
                    </h2>
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    {renderStars(4.2)}
                    <span className="text-sm text-gray-600">4.2/5</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">Téléphone: {tenant.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">Email: {tenant.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">Profession: Ingénieur Informatique</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">Date de naissance: 15/03/1985</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CIB Solvency Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Score de Solvabilité CIB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(cibScore.score / 1000) * 352} 352`}
                      className="text-blue-600"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900">{cibScore.score}</span>
                    <span className="text-sm text-gray-600">{cibScore.label}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Historique paiements</span>
                      <span className="font-semibold">{cibScore.paymentHistory}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${cibScore.paymentHistory}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Stabilité revenus</span>
                      <span className="font-semibold">{cibScore.incomeStability}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${cibScore.incomeStability}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Ratio endettement</span>
                      <span className="font-semibold">{cibScore.debtRatio}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${cibScore.debtRatio}%` }}
                      />
                    </div>
                  </div>
                  {cibScore.score >= 700 && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-800 font-medium">
                        Locataire recommandé - Risque faible
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique des Paiements
              </CardTitle>
              <Link href="/payments" className="text-sm text-blue-600 hover:text-blue-700">
                Voir tout
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tenant.paymentHistory && tenant.paymentHistory.length > 0 ? (
                  tenant.paymentHistory.slice(0, 3).map((payment: any, index: number) => {
                    const status = getPaymentStatus(payment);
                    const paymentDate = payment.paidAt ? new Date(payment.paidAt) : new Date(payment.createdAt);
                    const monthName = format(paymentDate, 'MMMM yyyy', { locale: fr });
                    
                    return (
                      <div key={payment.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${status.dotColor}`} />
                          <div>
                            <p className="font-medium text-gray-900">
                              Loyer {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Payé le {formatDate(payment.paidAt || payment.createdAt)} • {formatCurrency(payment.amount)}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${status.bgColor} ${status.color} border-0`}>
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun paiement enregistré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Guarantors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Cautions Solidaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Guarantors section - Currently no guarantors table in database */}
                {/* TODO: Add guarantors table and API endpoint when needed */}
                <div className="text-center py-8 text-gray-500">
                  <Handshake className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Aucun garant enregistré</p>
                  <p className="text-xs text-gray-400 mt-1">Cette fonctionnalité sera disponible prochainement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  const messagesSection = document.getElementById('tenant-messages');
                  messagesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer un message
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Phone className="h-4 w-4 mr-2" />
                Appeler
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Générer quittance
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Signaler un retard
              </Button>
            </CardContent>
          </Card>

          {/* Rental Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations locatives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Bien loué</p>
                <p className="font-medium text-gray-900">
                  {tenant.unitNumber} - {tenant.propertyName}
                </p>
                <p className="text-sm text-gray-500">Rue 15, Villa 123</p>
              </div>
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Loyer mensuel</span>
                  <span className="font-bold text-blue-600">{formatCurrency(tenant.rentAmount)}</span>
                </div>
                {tenant.lease && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Début du bail</span>
                      <span className="font-medium">{formatDate(tenant.lease.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Fin du bail</span>
                      <span className="font-medium">{formatDate(tenant.lease.endDate)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Caution versée</span>
                  <span className="font-medium">{formatCurrency(tenant.depositAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ongoing Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Tâches en cours
              </CardTitle>
              <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-700">
                + Nouvelle
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Renouvellement bail</p>
                  <p className="text-xs text-gray-500">Échéance: 31/12/2024</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Révision loyer annuelle</p>
                  <p className="text-xs text-gray-500">Échéance: 01/01/2025</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages Component with Real-time */}
          <div id="tenant-messages" className="h-[600px]">
            <TenantMessages 
              tenantId={tenant.id} 
              organizationId={tenant.organizationId || ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

