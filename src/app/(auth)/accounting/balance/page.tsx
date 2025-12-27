'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Scale, Loader2, ArrowLeft } from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Fetch balance data
async function getBalance(asOfDate?: string) {
  const params = new URLSearchParams();
  if (asOfDate) {
    params.append('asOfDate', asOfDate);
  }
  
  const response = await fetch(`/api/accounting/balance?${params.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch balance');
  }
  return response.json();
}

export default function BalancePage() {
  const { canAccessFeature, canAccessObject } = useAccess();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: balanceData, isLoading } = useDataQuery(
    ['balance', asOfDate],
    () => getBalance(asOfDate)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('accounting_sycoda_basic', 'canViewAccounting') && 
      !canAccessObject('JournalEntry', 'read')) {
    return (
      <AccessDenied
        featureName="Balance comptable"
        requiredPlan="premium"
        icon="lock"
      />
    );
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

  // Group accounts by category
  const accountsByCategory = balanceData?.accounts?.reduce((acc: any, account: any) => {
    const category = account.category || 'Autres';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(account);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/accounting">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Balance OHADA</h1>
            <p className="text-gray-600 mt-1">
              Balance générale des comptes au {format(new Date(asOfDate), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {/* Summary */}
      {balanceData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Débit</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(balanceData.totals.debit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Crédit</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(balanceData.totals.credit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Balance</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(Math.abs(balanceData.totals.balance))}
              </div>
              <Badge className={balanceData.totals.isBalanced ? 'bg-green-100 text-green-800 mt-2' : 'bg-red-100 text-red-800 mt-2'}>
                {balanceData.totals.isBalanced ? 'Équilibrée' : 'Déséquilibrée'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par compte</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : balanceData?.accounts && balanceData.accounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanceData.accounts.map((account: any) => (
                  <TableRow key={account.accountNumber}>
                    <TableCell className="font-medium">{account.accountNumber}</TableCell>
                    <TableCell>{account.accountLabel}</TableCell>
                    <TableCell className="text-right">
                      {account.debit > 0 ? formatNumber(account.debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.credit > 0 ? formatNumber(account.credit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(account.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Scale className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune donnée
              </h3>
              <p className="text-gray-600">
                Aucune écriture comptable trouvée pour cette date.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

