'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, ClipboardList, Wrench, Eye, Calendar, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface AgentDashboardProps {
  data: any;
}

export function AgentDashboard({ data }: AgentDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Operational Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Propriétés */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Propriétés</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.operations?.propertiesCount || 0}
            </div>
            <Link href="/properties" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Voir toutes →
            </Link>
          </CardContent>
        </Card>

        {/* Taux d'occupation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux d'occupation</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Home className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.occupancy?.rate}%
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.occupancy?.occupied}/{data?.occupancy?.total} lots occupés
            </div>
          </CardContent>
        </Card>

        {/* Mes tâches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mes tâches</CardTitle>
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.operations?.assignedTasks || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.tasks?.overdue} en retard
            </div>
          </CardContent>
        </Card>

        {/* États des lieux */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">États des lieux</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Eye className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.tasks?.inspections || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Cette semaine
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes tâches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mes tâches</CardTitle>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-700">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.operations?.myTasks && data.operations.myTasks.length > 0 ? (
                data.operations.myTasks.map((task: any) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                      task.priority === 'urgent' ? 'bg-red-100' :
                      task.priority === 'high' ? 'bg-orange-100' :
                      'bg-yellow-100'
                    }`}>
                      {task.title?.toLowerCase().includes('réparation') && <Wrench className={`h-5 w-5 ${
                        task.priority === 'urgent' ? 'text-red-600' :
                        task.priority === 'high' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />}
                      {task.title?.toLowerCase().includes('état des lieux') && <Eye className={`h-5 w-5 ${
                        task.priority === 'urgent' ? 'text-red-600' :
                        task.priority === 'high' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />}
                      {!task.title?.toLowerCase().includes('réparation') && !task.title?.toLowerCase().includes('état des lieux') && 
                        <ClipboardList className={`h-5 w-5 ${
                          task.priority === 'urgent' ? 'text-red-600' :
                          task.priority === 'high' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">{task.title}</p>
                        {task.priority === 'urgent' && (
                          <Badge className="bg-red-100 text-red-800 text-xs">Urgent</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{task.status}</span>
                        {task.dueDate && (
                          <>
                            <span>•</span>
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString('fr-FR')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune tâche assignée</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                data.upcomingInspections.map((inspection: any) => (
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
                      <p className="font-medium text-foreground">
                        État des lieux {inspection.type === 'entry' ? "d'entrée" : "de sortie"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {inspection.unit} - {inspection.property}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{inspection.date}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{inspection.contact}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucun état des lieux prévu</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

