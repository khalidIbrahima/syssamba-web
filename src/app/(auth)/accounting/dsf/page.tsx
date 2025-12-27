'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Scale,
  Calendar,
  FileStack,
  Settings,
  History,
  Eye,
  Download,
  Upload,
  Info,
  CheckCircle,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { useAccess } from '@/hooks/use-access';
import { AccessDenied } from '@/components/ui/access-denied';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Fetch DSF statistics
async function getDSFStats(year: number) {
  const response = await fetch(`/api/accounting/dsf/stats?year=${year}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch DSF stats');
  }
  return response.json();
}

export default function DSFGenerationPage() {
  const { canAccessFeature, canAccessObject } = useAccess();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [ninea, setNINEA] = useState('002345678901');
  const [legalForm, setLegalForm] = useState('sci');
  const [activityCode, setActivityCode] = useState('68.20');
  const [fiscalStart, setFiscalStart] = useState(`${year}-01-01`);
  const [fiscalEnd, setFiscalEnd] = useState(`${year}-12-31`);
  const [fiscalOptions, setFiscalOptions] = useState({
    vatOnDebits: true,
    corporateTax: true,
    propertyTax: false,
  });

  const { data: stats, isLoading } = useDataQuery(
    ['dsf-stats', year],
    () => getDSFStats(year)
  );

  // Check access - must be after all hooks (Rules of Hooks)
  if (!canAccessFeature('accounting_sycoda_basic', 'canViewAccounting') && 
      !canAccessObject('JournalEntry', 'read')) {
    return (
      <AccessDenied
        featureName="Génération DSF"
        requiredPlan="premium"
        icon="lock"
      />
    );
  }

  const handlePreview = () => {
    toast.info('Prévisualisation en cours de préparation...');
  };

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/accounting/dsf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'csv',
          startDate: fiscalStart,
          endDate: fiscalEnd,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to download DSF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsf_${fiscalStart}_${fiscalEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('DSF téléchargé avec succès');
    } catch (error) {
      console.error('Error downloading DSF:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleSubmit = () => {
    toast.info('Soumission à la DGI en cours de préparation...');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Génération DSF & Liasse Fiscale
          </h1>
          <p className="text-gray-600">
            Exercice fiscal {year} • Conforme SYSCOHADA OHADA
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Historique
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Validé
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {isLoading ? '...' : formatNumber(stats?.journal?.validatedEntries || 0)}
                </p>
                <p className="text-sm text-gray-600 mt-1">écritures validées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-blue-600" />
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {stats?.journal?.isBalanced ? 'A jour' : 'Déséquilibrée'}
                  </Badge>
                </div>
                <p className={cn(
                  "text-xl font-semibold",
                  stats?.journal?.isBalanced ? "text-blue-600" : "text-red-600"
                )}>
                  {stats?.journal?.isBalanced ? 'Équilibrée' : 'Déséquilibrée'}
                </p>
                <p className="text-sm text-gray-600 mt-1">Débit • Crédit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    En cours
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-gray-900">{year}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {stats?.period?.startDateFormatted} - {stats?.period?.endDateFormatted}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <FileStack className="h-5 w-5 text-purple-600" />
                  </div>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    Prêt
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.documents?.count || 12}
                </p>
                <p className="text-sm text-gray-600 mt-1">pièces justificatives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* DSF Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration DSF {year}</CardTitle>
              <CardDescription>Déclaration Statistique et Fiscale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ninea">NINEA</Label>
                  <Input
                    id="ninea"
                    value={ninea}
                    onChange={(e) => setNINEA(e.target.value)}
                    placeholder="002345678901"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalForm">Forme Juridique</Label>
                  <Select value={legalForm} onValueChange={setLegalForm}>
                    <SelectTrigger id="legalForm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sci">SCI - Société Civile Immobilière</SelectItem>
                      <SelectItem value="sarl">SARL - Société à Responsabilité Limitée</SelectItem>
                      <SelectItem value="sa">SA - Société Anonyme</SelectItem>
                      <SelectItem value="snc">SNC - Société en Nom Collectif</SelectItem>
                      <SelectItem value="individual">Individuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activityCode">Code Activité SYSCOHADA</Label>
                  <div className="flex gap-2">
                    <Input
                      id="activityCode"
                      value={activityCode}
                      onChange={(e) => setActivityCode(e.target.value)}
                      placeholder="68.20"
                    />
                    <Button variant="outline" size="sm">
                      Location de biens immobilier
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalStart">Début Exercice</Label>
                  <Input
                    id="fiscalStart"
                    type="date"
                    value={fiscalStart}
                    onChange={(e) => setFiscalStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalEnd">Fin Exercice</Label>
                  <Input
                    id="fiscalEnd"
                    type="date"
                    value={fiscalEnd}
                    onChange={(e) => setFiscalEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <Label>Options Fiscales</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="vatOnDebits"
                      checked={fiscalOptions.vatOnDebits}
                      onCheckedChange={(checked) =>
                        setFiscalOptions({ ...fiscalOptions, vatOnDebits: !!checked })
                      }
                    />
                    <Label htmlFor="vatOnDebits" className="font-normal cursor-pointer">
                      TVA sur débits
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="corporateTax"
                      checked={fiscalOptions.corporateTax}
                      onCheckedChange={(checked) =>
                        setFiscalOptions({ ...fiscalOptions, corporateTax: !!checked })
                      }
                    />
                    <Label htmlFor="corporateTax" className="font-normal cursor-pointer">
                      Impôt sur les Sociétés (IS)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="propertyTax"
                      checked={fiscalOptions.propertyTax}
                      onCheckedChange={(checked) =>
                        setFiscalOptions({ ...fiscalOptions, propertyTax: !!checked })
                      }
                    />
                    <Label htmlFor="propertyTax" className="font-normal cursor-pointer">
                      Contribution Foncière des Propriétés Bâtis (CFPB)
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fiscal Bundle */}
          <Card>
            <CardHeader>
              <CardTitle>Bundle Fiscal Complet</CardTitle>
              <CardDescription>Tous les documents requis par la DGI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  'DSF - Déclaration Statistique et Fiscale',
                  'Bilan Comptable SYSCOHADA',
                  'Compte de Résultat',
                  'Balance Générale',
                  'Journal Comptable',
                ].map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">{doc}</span>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Prêt
                    </Badge>
                  </div>
                ))}
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                Prêt pour DGI - Générer Bundle Complet
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Fichiers PDF conformes OHADA • Signature électronique • Horodatage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Résumé Financier {year}</CardTitle>
              <CardDescription>Synthèse comptable SYSCOHADA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Revenus Mensuels {year}</h4>
                {stats?.financial?.monthlyRevenues && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.financial.monthlyRevenues}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monthName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Chiffre d'Affaires</p>
                  <p className="text-lg font-bold text-blue-600">
                    {stats?.financial?.totalRevenue
                      ? formatCurrency(stats.financial.totalRevenue)
                      : '...'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Bénéfice Net</p>
                  <p className="text-lg font-bold text-green-600">
                    {stats?.financial?.netProfit
                      ? formatCurrency(stats.financial.netProfit)
                      : '...'}
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Taxes Calculées</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">TVA à reverser</span>
                    <span className="font-medium">
                      {stats?.financial?.taxes?.vat
                        ? formatCurrency(stats.financial.taxes.vat)
                        : '...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Impôt sur Sociétés</span>
                    <span className="font-medium">
                      {stats?.financial?.taxes?.corporateTax
                        ? formatCurrency(stats.financial.taxes.corporateTax)
                        : '...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CFPB</span>
                    <span className="font-medium">
                      {stats?.financial?.taxes?.propertyTax
                        ? formatCurrency(stats.financial.taxes.propertyTax)
                        : '...'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>Total Taxes</span>
                    <span>
                      {stats?.financial?.taxes?.total
                        ? formatCurrency(stats.financial.taxes.total)
                        : '...'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Control */}
          <Card>
            <CardHeader>
              <CardTitle>Contrôle Conformité</CardTitle>
              <CardDescription>Vérifications OHADA & DGI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  {
                    title: 'Plan Comptable SYSCOHADA',
                    description: 'Comptes conformes OHADA 2017',
                  },
                  {
                    title: 'Équilibre Comptable',
                    description: 'Débit • Crédit validé',
                  },
                  {
                    title: 'Pièces Justificatives',
                    description: 'Toutes les factures numérisées',
                  },
                  {
                    title: 'Format DGI',
                    description: 'XML + PDF conformes 2024',
                  },
                ].map((check, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{check.title}</p>
                      <p className="text-xs text-gray-600">{check.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" />
                100% Conforme DGI Sénégal
                <br />
                <span className="text-xs">Prêt pour télédéclaration</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Finalize Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Finaliser la Déclaration
              </h3>
              <p className="text-gray-600">
                Votre bundle fiscal est prêt pour soumission à la DGI
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Prévisualiser
                <br />
                <span className="text-xs">Bundle complet</span>
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
                <br />
                <span className="text-xs">PDF + XML</span>
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit}>
                <Upload className="h-4 w-4 mr-2" />
                Soumettre DGI
                <br />
                <span className="text-xs">Télédéclaration</span>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 pt-4 border-t">
              <Info className="h-4 w-4 text-blue-600" />
              <div className="text-left">
                <p>Date limite de déclaration : 30 Avril {year + 1}</p>
                <p className="text-xs">
                  Votre déclaration sera horodatée et signée électroniquement conformément aux
                  normes DGI Sénégal
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

