'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Eye } from 'lucide-react';

interface ViewerDashboardProps {
  data: any;
}

export function ViewerDashboard({ data }: ViewerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Read-only Overview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Taux d'occupation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux d'occupation</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Home className="h-5 w-5 text-blue-600" />
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

        {/* Tâches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tâches en cours</CardTitle>
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Eye className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">
              {data?.tasks?.total || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Tâches actives
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

      {/* Info Message */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              Vous avez un accès en lecture seule.
            </p>
            <p className="text-sm text-muted-foreground">
              Contactez votre administrateur pour obtenir plus de permissions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

