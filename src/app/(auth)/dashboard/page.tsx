'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  PiggyBank,
  Home,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  Calendar,
  Wrench,
  Send,
  FileText,
  Eye,
  Clock,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Link from 'next/link';
import { useUser } from '@/hooks/use-user';

// Fetch dashboard data from API
async function getDashboardData() {
  const response = await fetch('/api/dashboard', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export default function DashboardPage() {
  const { canAccessFeature } = useAccess();
  const { user } = useUser();
  const { data, isLoading } = useDataQuery(['dashboard-data'], getDashboardData);

  // Check access: user needs either canViewAllProperties OR canRead access on Property
  // Doit être après tous les hooks pour respecter les Rules of Hooks
  const { canAccessObject } = useAccess();
  const hasViewAllAccess = canAccessFeature('dashboard', 'canViewAllProperties');
  const hasReadAccess = canAccessObject('Property', 'read');
  
  if (!hasViewAllAccess && !hasReadAccess) {
    return (
      <AccessDenied
        featureName="Tableau de bord"
        requiredPlan="starter"
        icon="shield"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lotTotal = data?.lotDistribution?.reduce((sum: number, item: { value: number }) => sum + item.value, 0) || 0;
  const occupiedPercentage = data?.lotDistribution?.find((l: { name: string; value: number }) => l.name === 'Occupés')?.value || 0;
  const occupiedPercent = lotTotal > 0 ? ((occupiedPercentage / lotTotal) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Bienvenue, {user?.firstName || 'Utilisateur'} 👋
        </h2>
        <p className="text-gray-600">
          Voici un aperçu de votre activité immobilière aujourd'hui
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Trésorerie du mois */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Trésorerie du mois</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {data?.treasury.amount.toLocaleString('fr-FR')} F
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 text-xs">
                +{data?.treasury.change}%
              </Badge>
              <span className="text-xs text-gray-600">
                ↑+{data?.treasury.changeAmount.toLocaleString('fr-FR')} F vs mois dernier
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Taux d'occupation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taux d'occupation</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {data?.occupancy.rate}%
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 text-xs">Excellent</Badge>
              <span className="text-xs text-gray-600">
                {data?.occupancy.occupied}/{data?.occupancy.total} lots occupés
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Impayés en retard */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Impayés en retard</CardTitle>
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 mb-1">
              {data?.overdue.amount.toLocaleString('fr-FR')} F
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 text-xs">Urgent</Badge>
              <span className="text-xs text-gray-600">
                {data?.overdue.count} locataires à relancer
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tâches en cours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tâches en cours</CardTitle>
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {data?.tasks.total}
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                {data?.tasks.overdue} en retard
              </Badge>
              <span className="text-xs text-gray-600">
                {data?.tasks.inspections} états des lieux cette semaine
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des revenus */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Évolution des revenus</CardTitle>
            <Link href="/accounting" className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
              Détails <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {data?.revenueData && data.revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${(value / 1000000).toFixed(2)}M FCFA`}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
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
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>Aucune donnée de revenus disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition des lots */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Répartition des lots</CardTitle>
            <Link href="/units" className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
              Détails <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data?.lotDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data?.lotDistribution?.map((entry: { color: string }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    Occupés
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mt-1">
                    {occupiedPercent}%
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-6">
              {data?.lotDistribution?.map((item: { name: string; color: string }, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prochains états des lieux */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prochains états des lieux</CardTitle>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-700">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.upcomingInspections && data.upcomingInspections.length > 0 ? (
                data.upcomingInspections.map((inspection: { id: string; type: string; unit: string; property: string; date: string; contact: string; color: string }) => (
                <div key={inspection.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    inspection.color === 'blue' ? 'bg-blue-100' :
                    inspection.color === 'red' ? 'bg-red-100' :
                    'bg-green-100'
                  }`}>
                    <Eye className={`h-5 w-5 ${
                      inspection.color === 'blue' ? 'text-blue-600' :
                      inspection.color === 'red' ? 'text-red-600' :
                      'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      État des lieux {inspection.type === 'entry' ? "d'entrée" : "de sortie"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {inspection.unit} - {inspection.property}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{inspection.date}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{inspection.contact}</span>
                    </div>
                  </div>
                </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Aucun état des lieux prévu</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tâches en retard */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Tâches en retard</CardTitle>
              <Badge className="bg-red-500 text-white">{data?.tasks.overdue}</Badge>
            </div>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-700">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.overdueTasks && data.overdueTasks.length > 0 ? (
                data.overdueTasks.map((task: { id: string; title: string; unit: string; priority: string; days: number; color: string }) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    task.color === 'red' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    {task.title.includes('Réparation') && <Wrench className={`h-5 w-5 ${task.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />}
                    {task.title.includes('Relance') && <Send className={`h-5 w-5 ${task.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />}
                    {task.title.includes('Renouvellement') && <FileText className={`h-5 w-5 ${task.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />}
                    {task.title.includes('Visite') && <Eye className={`h-5 w-5 ${task.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />}
                    {task.title.includes('Envoi') && <Send className={`h-5 w-5 ${task.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.priority === 'urgent' && (
                        <Badge className="bg-red-100 text-red-800 text-xs">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{task.unit}</p>
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <Clock className="h-3 w-3" />
                      <span>Retard: {task.days} jour{task.days > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Aucune tâche en retard</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}