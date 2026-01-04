'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { usePageAccess } from '@/hooks/use-page-access';
import { PageLoader } from '@/components/ui/page-loader';
import { FeatureGate } from '@/components/features/FeatureGate';
import { PermissionGate } from '@/components/permissions/PermissionGate';

export default function NotificationsPage() {
  const { isLoading: isAccessLoading } = usePageAccess();

  // Wait for access data to load
  if (isAccessLoading) {
    return <PageLoader message="Chargement..." />;
  }

  return (
    <FeatureGate
      feature="messaging"
      showUpgrade={true}
    >
      <PermissionGate
        objectType="Message"
        action="read"
        showDenied={true}
        deniedMessage="Vous n'avez pas la permission de voir les notifications."
      >
    <div className="space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Centre de messagerie et historique</p>
        </div>
        <Button>Nouvelle notification</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2 text-blue-600" />
              Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24</div>
            <p className="text-sm text-muted-foreground">Envoyés ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
              SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-sm text-muted-foreground">Relances impayés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Smartphone className="h-5 w-5 mr-2 text-purple-600" />
              Push
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">8</div>
            <p className="text-sm text-muted-foreground">Notifications app</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des notifications</CardTitle>
          <CardDescription>Toutes vos communications récentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { type: 'email', title: 'Relance loyer - Diallo Amadou', date: '2024-12-04', status: 'sent' },
              { type: 'sms', title: 'Rappel entretien - Lot A102', date: '2024-12-03', status: 'delivered' },
            ].map((notification, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {notification.type === 'email' && <Mail className="h-5 w-5 text-blue-600" />}
                  {notification.type === 'sms' && <MessageSquare className="h-5 w-5 text-green-600" />}
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">{notification.date}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  notification.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {notification.status === 'sent' ? 'Envoyé' : 'Livré'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
      </PermissionGate>
    </FeatureGate>
  );
}

