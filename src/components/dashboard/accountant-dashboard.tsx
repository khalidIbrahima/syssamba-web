'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PiggyBank, FileText, Clock, TrendingUp, DollarSign, Receipt } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/contexts/theme-context';
import { useEffect, useState } from 'react';

interface AccountantDashboardProps {
  data: any;
}

export function AccountantDashboard({ data }: AccountantDashboardProps) {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
  }, [theme]);

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDark ? 'hsl(222.2 84% 4.9%)' : '#fff';
  const tooltipBorder = isDark ? 'hsl(217.2 32.6% 17.5%)' : '#e5e7eb';
  const tooltipText = isDark ? 'hsl(210 40% 98%)' : '#111827';

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Trésorerie du mois */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trésorerie du mois</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.treasury?.amount.toLocaleString('fr-FR')} F
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs">
                {data?.treasury?.change > 0 ? '+' : ''}{data?.treasury?.change}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                vs mois dernier
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Paiements en attente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paiements en attente</CardTitle>
            <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.accounting?.pendingPayments?.amount.toLocaleString('fr-FR')} F
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.accounting?.pendingPayments?.count} paiements
            </div>
          </CardContent>
        </Card>

        {/* Écritures comptables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Écritures comptables</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.accounting?.journalEntriesCount || 0}
            </div>
            <Link href="/accounting" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Voir le journal →
            </Link>
          </CardContent>
        </Card>

        {/* Impayés */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impayés en retard</CardTitle>
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
              {data?.overdue?.amount.toLocaleString('fr-FR')} F
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.overdue?.count} locataires
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des revenus */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution des revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.revenueData && data.revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis 
                    dataKey="month" 
                    stroke={axisColor}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke={axisColor}
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${(value / 1000000).toFixed(2)}M FCFA`}
                    contentStyle={{ 
                      backgroundColor: tooltipBg, 
                      border: `1px solid ${tooltipBorder}`, 
                      borderRadius: '8px',
                      color: tooltipText
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>Aucune donnée de revenus disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/accounting" className="block p-4 rounded-lg border border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-medium text-foreground">Journal comptable</div>
                  <div className="text-sm text-muted-foreground">Gérer les écritures comptables</div>
                </div>
              </div>
            </Link>
            <Link href="/payments" className="block p-4 rounded-lg border border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <div className="font-medium text-foreground">Paiements</div>
                  <div className="text-sm text-muted-foreground">Voir et gérer les paiements</div>
                </div>
              </div>
            </Link>
            <Link href="/payments?tab=owner-transfers" className="block p-4 rounded-lg border border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <div className="font-medium text-foreground">Virements propriétaires</div>
                  <div className="text-sm text-muted-foreground">Gérer les virements</div>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

