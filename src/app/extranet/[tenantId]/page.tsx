'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, CreditCard, FileText, MessageSquare, AlertTriangle, Calendar, DollarSign } from 'lucide-react';

export default function TenantExtranetPage({ params }: { params: { tenantId: string } }) {
  // Mock data - en production, récupérer depuis l'API avec params.tenantId
  const tenantData = {
    name: 'Diallo Amadou',
    unit: 'A101',
    property: 'Résidence les Alizés',
    rentAmount: 450000,
    nextPayment: '2024-12-15',
    balance: 0,
    hasUnreadMessages: true,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bonjour {tenantData.name}
          </h1>
          <p className="text-gray-600">
            Lot {tenantData.unit} - {tenantData.property}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Loyer mensuel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenantData.rentAmount.toLocaleString('fr-FR')} FCFA
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Prochaine échéance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(tenantData.nextPayment).toLocaleDateString('fr-FR')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                {tenantData.balance === 0 ? (
                  <Home className="h-5 w-5 mr-2 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                )}
                Solde
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                tenantData.balance === 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {tenantData.balance === 0 ? 'À jour' : `${tenantData.balance.toLocaleString('fr-FR')} FCFA`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Paiements
              </CardTitle>
              <CardDescription>Régler votre loyer en ligne</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full" size="lg">
                  Payer maintenant (Wave)
                </Button>
                <Button variant="outline" className="w-full">
                  Payer avec Orange Money
                </Button>
                <Button variant="outline" className="w-full">
                  Historique des paiements
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Messagerie
                {tenantData.hasUnreadMessages && (
                  <Badge className="ml-2 bg-red-500">Nouveau</Badge>
                )}
              </CardTitle>
              <CardDescription>Contactez votre gestionnaire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" className="w-full">
                  Voir mes messages
                </Button>
                <Button variant="outline" className="w-full">
                  Signaler un problème
                </Button>
                <Button variant="outline" className="w-full">
                  Demander une intervention
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Documents
              </CardTitle>
              <CardDescription>Quittances et contrats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Quittance novembre 2024</span>
                  <Button size="sm" variant="outline">Télécharger</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Contrat de bail</span>
                  <Button size="sm" variant="outline">Télécharger</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Règlement intérieur</span>
                  <Button size="sm" variant="outline">Télécharger</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations pratiques</CardTitle>
              <CardDescription>Contacts et horaires</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-sm">Gestionnaire</p>
                  <p className="text-sm text-gray-600">Marie Dupont</p>
                  <p className="text-sm text-gray-600">+221 77 123 45 67</p>
                </div>
                <div>
                  <p className="font-medium text-sm">Horaires d'urgence</p>
                  <p className="text-sm text-gray-600">24h/24 - 7j/7</p>
                  <p className="text-sm text-gray-600">+221 76 987 65 43</p>
                </div>
                <div>
                  <p className="font-medium text-sm">Prochaine visite technique</p>
                  <p className="text-sm text-gray-600">15 janvier 2025</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
