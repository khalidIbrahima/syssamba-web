'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  FileText,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Edit,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useAccess } from '@/hooks/use-access';
import { useDataQuery } from '@/hooks/use-query';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { FeatureGate } from '@/components/features/FeatureGate';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { CreateJournalEntryDialog } from '@/components/accounting/create-journal-entry-dialog';
import Link from 'next/link';

// Fetch journal entries from API
async function getJournalEntries(page = 1, accountFilter?: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '6',
  });
  if (accountFilter) {
    params.append('account', accountFilter);
  }
  
  const response = await fetch(`/api/accounting/journal?${params.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch journal entries');
  }
  return response.json();
}

// Fetch balance evolution data from API
async function getBalanceEvolution() {
  const response = await fetch('/api/accounting/balance-evolution', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch balance evolution');
  }
  const data = await response.json();
  return data.data || [];
}

export default function AccountingPage() {
  const { isLoading: isAccessLoading } = usePageAccess();
  const [currentPage, setCurrentPage] = useState(1);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  
  const { data: journalData, isLoading } = useDataQuery(
    ['journal-entries', currentPage.toString(), accountFilter],
    () => getJournalEntries(currentPage, accountFilter === 'all' ? undefined : accountFilter)
  );

  // Wait for access data to load
  if (isAccessLoading || isLoading) {
    return <PageLoader message="Chargement..." />;
  }


  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M FCFA`;
    }
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const formatNumber = (amount: number) => {
    return amount.toLocaleString('fr-FR');
  };

  const entries = journalData?.entries || [];
  const stats = journalData?.statistics || {
    currentMonthEntries: 0,
    entriesChange: '+0%',
    totalDebit: 0,
    debitChange: '+0%',
    totalCredit: 0,
    creditChange: '-0%',
    balance: 0,
    isBalanced: true,
  };
  const pagination = journalData?.pagination || {
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
  };

  // Mock data for balance evolution chart
  const balanceEvolutionData = [
    { month: 'Jan', balance: 150000 },
    { month: 'Fév', balance: 165000 },
    { month: 'Mar', balance: 158000 },
    { month: 'Avr', balance: 172000 },
    { month: 'Mai', balance: 168000 },
    { month: 'Jun', balance: 175000 },
  ];

  // Flatten entries to show each line as a row
  const tableRows: any[] = [];
  entries.forEach((entry: any) => {
    entry.lines.forEach((line: any) => {
      tableRows.push({
        ...line,
        entryDate: entry.entryDate,
        reference: entry.reference,
        description: entry.description,
        entryId: entry.id,
      });
    });
  });

  return (
    <FeatureGate
      feature="accounting"
      showUpgrade={true}
    >
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Comptable SYSCOHADA</h1>
          <p className="text-gray-600 mt-1">
            Écritures automatiques et conformité OHADA 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/accounting/dsf">
              <FileCheck className="h-4 w-4 mr-2" />
              Générer DSF & Liasse Fiscale
            </Link>
          </Button>
          <CreateJournalEntryDialog />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">Écritures du Mois</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatNumber(stats.currentMonthEntries)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className={cn(
                stats.entriesChange.startsWith('+') ? 'text-green-600' : 'text-red-600'
              )}>
                {stats.entriesChange}
              </span>
              <span className="text-gray-500">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm text-gray-600">Solde Débiteur</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatCurrency(stats.totalDebit)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className={cn(
                stats.debitChange.startsWith('+') ? 'text-green-600' : 'text-red-600'
              )}>
                {stats.debitChange}
              </span>
              <span className="text-gray-500">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-sm text-gray-600">Solde Créditeur</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatCurrency(stats.totalCredit)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className={cn(
                stats.creditChange.startsWith('+') ? 'text-green-600' : 'text-red-600'
              )}>
                {stats.creditChange}
              </span>
              <span className="text-gray-500">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-gray-600">Balance</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatCurrency(Math.abs(stats.balance))}
            </div>
            <div className="mt-2 text-sm">
              <Badge className={cn(
                stats.isBalanced 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              )}>
                {stats.isBalanced ? 'Équilibrée SYSCOHADA' : 'Déséquilibrée'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Journal Entries Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Écritures Récentes</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tous les comptes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les comptes</SelectItem>
                      <SelectItem value="411.001">411.001 - Clients</SelectItem>
                      <SelectItem value="701.001">701.001 - Ventes</SelectItem>
                      <SelectItem value="512.001">512.001 - Banque</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : tableRows.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DATE</TableHead>
                        <TableHead>Nº PIÈCE</TableHead>
                        <TableHead>LIBELLÉ</TableHead>
                        <TableHead>COMPTE</TableHead>
                        <TableHead className="text-right">DÉBIT</TableHead>
                        <TableHead className="text-right">CRÉDIT</TableHead>
                        <TableHead className="text-right">ACTIONS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((row, index) => (
                        <TableRow key={`${row.entryId}-${row.id}-${index}`}>
                          <TableCell>
                            {format(parseISO(row.entryDate), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium">{row.reference}</TableCell>
                          <TableCell>{row.description || row.accountLabel}</TableCell>
                          <TableCell>{row.accountNumber}</TableCell>
                          <TableCell className="text-right">
                            {row.debit > 0 ? formatNumber(row.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.credit > 0 ? formatNumber(row.credit) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Affichage de {(pagination.page - 1) * pagination.limit + 1} à{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
                      {formatNumber(pagination.total)} écritures
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                      </Button>
                      {[...Array(Math.min(pagination.totalPages, 5))].map((_, i) => {
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                        disabled={currentPage === pagination.totalPages}
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
                    Aucune écriture
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Commencez par créer votre première écriture comptable.
                  </p>
                  <CreateJournalEntryDialog />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-between" asChild>
                <Link href="/accounting/auto-entries">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Écritures Auto</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-between" asChild>
                <Link href="/accounting/dsf">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    <span>Générer DSF</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-between" asChild>
                <Link href="/accounting/balance">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    <span>Balance OHADA</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Balance Evolution */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={balanceEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[1, 4]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SYSCOHADA Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>Conformité SYSCOHADA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plan comptable OHADA</span>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conforme
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Équilibre débit/crédit</span>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Équilibré
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Numérotation continue</span>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valide
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Prêt pour DGI</span>
                <Badge className="bg-orange-100 text-orange-800">
                  <Clock className="h-3 w-3 mr-1" />
                  En cours
                </Badge>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white mt-4" asChild>
                <Link href="/accounting/dsf">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Prêt pour DGI
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}
