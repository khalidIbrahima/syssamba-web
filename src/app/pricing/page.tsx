'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/hooks/use-user';
import {
  Building2,
  Check,
  X,
  Users,
  Home,
  Globe,
  Send,
  Calendar,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  Loader2,
  LayoutDashboard,
} from 'lucide-react';

interface PlanFeature {
  text: string;
  included: boolean;
  category?: string;
}

interface PricingPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number | null | string; // number | null from API, string for fallback
  priceYearly: number | null | string; // number | null from API, string for fallback
  priceType: 'fixed' | 'custom';
  features: PlanFeature[];
  limits: {
    lots: number | null;
    users: number | null;
    extranetTenants: number | null;
  };
  isActive: boolean;
  popular?: boolean;
}

// Fallback plans in case API fails
const fallbackPlans: PricingPlan[] = [
  {
    id: '',
    name: 'starter',
    displayName: 'Starter',
    description: 'Parfait pour débuter',
    priceMonthly: '0',
    priceYearly: '0',
    priceType: 'fixed',
    features: [
      { text: 'Lots: 1', included: true },
      { text: 'Utilisateurs: 1', included: true },
      { text: 'Intranet locataires: 5', included: true },
      { text: 'Domaine personnalisé', included: false },
      { text: 'Gestion de base', included: true },
      { text: 'États des lieux mobile', included: true },
      { text: 'Paiements Wave/Orange', included: true },
      { text: 'Comptabilité SYSCOHADA', included: false },
    ],
    limits: { lots: 1, users: 1, extranetTenants: 5 },
    isActive: true,
    popular: false,
  },
  {
    id: '',
    name: 'essentiel',
    displayName: 'Essentiel',
    description: 'Pour les petites agences',
    priceMonthly: '15000',
    priceYearly: '12000',
    priceType: 'fixed',
    features: [
      { text: 'Lots: 25', included: true },
      { text: 'Utilisateurs: 3', included: true },
      { text: 'Intranet locataires: 25', included: true },
      { text: 'Domaine personnalisé', included: false },
      { text: 'Tout du plan Starter', included: true },
      { text: 'Comptabilité SYSCOHADA', included: true },
      { text: 'Génération DGF', included: true },
      { text: 'Support prioritaire', included: true },
    ],
    limits: { lots: 25, users: 3, extranetTenants: 25 },
    isActive: true,
    popular: false,
  },
  {
    id: '',
    name: 'agency',
    displayName: 'Agence',
    description: 'Pour les agences établies',
    priceMonthly: '35000',
    priceYearly: '28000',
    priceType: 'fixed',
    features: [
      { text: 'Lots: 100', included: true },
      { text: 'Utilisateurs: 10', included: true },
      { text: 'Intranet locataires: 100', included: true },
      { text: 'Domaine personnalisé', included: true },
      { text: 'Tout du plan Essentiel', included: true },
      { text: 'Extranet personnalisé', included: true },
      { text: 'API complète', included: true },
      { text: 'Formation incluse', included: true },
    ],
    limits: { lots: 100, users: 10, extranetTenants: 100 },
    isActive: true,
    popular: true,
  },
  {
    id: '',
    name: 'syndic',
    displayName: 'Syndic',
    description: 'Pour les syndics',
    priceMonthly: '50000',
    priceYearly: '40000',
    priceType: 'fixed',
    features: [
      { text: 'Lots: 300', included: true },
      { text: 'Utilisateurs: 25', included: true },
      { text: 'Intranet locataires: 300', included: true },
      { text: 'Domaine personnalisé', included: true },
      { text: 'Tout du plan Agence', included: true },
      { text: 'Gestion copropriété', included: true },
      { text: 'Assemblées générales', included: true },
      { text: 'Support dédié', included: true },
    ],
    limits: { lots: 300, users: 25, extranetTenants: 300 },
    isActive: true,
    popular: false,
  },
  {
    id: '',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Marque blanche',
    priceMonthly: 'custom',
    priceYearly: 'custom',
    priceType: 'custom',
    features: [
      { text: 'Lots: Illimité', included: true },
      { text: 'Utilisateurs: Illimité', included: true },
      { text: 'Intranet locataires: Illimité', included: true },
      { text: 'Marque blanche', included: true },
      { text: 'Solution complète', included: true },
      { text: 'Domaine propre (LAD)', included: true },
      { text: 'Support 24/7', included: true },
      { text: 'Déploiement dédié', included: true },
    ],
    limits: { lots: null, users: null, extranetTenants: null },
    isActive: true,
    popular: false,
  },
];

const faqs = [
  {
    question: 'Puis-je changer de plan à tout moment?',
    answer: 'Oui, vous pouvez upgrader ou downgrader votre plan à tout moment depuis votre tableau de bord. Les changements prennent effet immédiatement.',
  },
  {
    question: "Qu'est-ce qu'un extranet locataire personnalisé?",
    answer: "C'est un portail web avec votre propre domaine (ex: locataires.votreagence.samba.one) où vos locataires peuvent consulter leurs informations et payer leurs loyers.",
  },
  {
    question: 'La comptabilité SYSCOHADA est-elle vraiment conforme?',
    answer: 'Absolument. Notre module comptable respecte les normes OHADA et génère automatiquement les DGF conformes aux exigences de la DGI sénégalaise.',
  },
];

export default function PricingPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const isLoggedIn = !!user;
  const router = useRouter();
  const pathname = usePathname();
  const [isAnnual, setIsAnnual] = useState(false); // Default to Mensuel (monthly)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/public/pricing');
        if (!response.ok) {
          throw new Error('Failed to fetch plans');
        }
        const data = await response.json();
        setPlans(data.plans || []);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError('Erreur lors du chargement des plans');
        // Use fallback plans if API fails
        setPlans(fallbackPlans);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const formatPrice = (price: number | null | string, isAnnual: boolean) => {
    // Handle null (custom pricing)
    if (price === null) return 'Sur devis';
    
    // Handle string values (for fallback plans)
    if (typeof price === 'string') {
      if (price === 'Sur devis' || price === 'custom') return 'Sur devis';
      if (price === '0') return isAnnual ? '0 FCFA /an' : '0 FCFA /mois';
      const numPrice = parseInt(price.replace(/,/g, ''));
      if (isNaN(numPrice)) return 'Sur devis';
      return `${numPrice.toLocaleString('fr-FR')} FCFA ${isAnnual ? '/an' : '/mois'}`;
    }
    
    // Handle number values (from API)
    if (typeof price === 'number') {
      if (price === 0) return isAnnual ? '0 FCFA /an' : '0 FCFA /mois';
      return `${price.toLocaleString('fr-FR')} FCFA ${isAnnual ? '/an' : '/mois'}`;
    }
    
    return 'Sur devis';
  };

  const getCtaText = (plan: PricingPlan) => {
    if (plan.priceType === 'custom' || plan.displayName.toLowerCase() === 'enterprise') {
      return 'Nous contacter';
    }
    // Check if plan is free (price is 0)
    const isFree = plan.priceMonthly === '0' || plan.priceYearly === '0';
    return isFree ? 'Essai gratuit' : 'Commencer';
  };

  const getCtaColor = (plan: PricingPlan) => {
    if (plan.popular) return 'orange';
    if (plan.priceType === 'custom') return 'green';
    return 'default';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Same as home page */}
      <header className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50 h-20 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo width={180} height={50} />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-blue-600 transition-colors">Fonctionnalités</Link>
            <Link href="/pricing" className="hover:text-blue-600 transition-colors">Tarifs</Link>
            <Link href="#about" className="hover:text-blue-600 transition-colors">À propos</Link>
            <Link href="#contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center border border-border rounded-md px-1 py-1 bg-card overflow-hidden">
              <button 
                onClick={() => {
                  router.push('/fr/pricing');
                }}
                className="px-2 py-1 text-xs font-bold text-white bg-primary"
              >
                FR
              </button>
              <button 
                onClick={() => {
                  router.push('/en/pricing');
                }}
                className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                EN
              </button>
            </div>

            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <Button variant="outline" className="hidden sm:flex items-center gap-2" asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Tableau de bord
                  </Link>
                </Button>
              ) : (
                <>
                  <Link href="/auth/sign-in" className="text-sm font-semibold text-muted-foreground hover:text-blue-600 hidden sm:block">
                    Connexion
                  </Link>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6" asChild>
                    <Link href="/auth/sign-up">Essai gratuit</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20">
        {/* Title Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Choisissez votre plan SYS SAMBA 
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Des solutions adaptées à chaque professionnel de l'immobilier au Sénégal
            </p>
          </div>

          {/* Pricing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                isAnnual ? 'bg-green-500' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isAnnual ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
                Annuel
              </span>
              {isAnnual && (
                <Badge className="bg-green-500 text-white text-xs">-20%</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex flex-wrap justify-center items-start gap-6">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative w-full max-w-xs mx-auto ${plan.popular ? 'ring-2 ring-orange-500 shadow-xl' : 'shadow-lg'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-orange-500 text-white px-3 py-1 text-xs font-bold">
                      POPULAIRE
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-bold">{plan.displayName}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                  <div className="mt-4 flex items-center justify-center">
                    <div className="text-3xl font-bold text-foreground text-center">
                      {formatPrice(isAnnual ? plan.priceYearly : plan.priceMonthly, isAnnual)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="text-center">
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 text-left">Fonctionnalités incluses:</h3>
                    <ul className="space-y-2.5 text-left max-h-[500px] overflow-y-auto">
                      {plan.features && plan.features.length > 0 ? (
                        plan.features.map((feature, featureIndex) => {
                          // Show category separator if category changes
                          const prevFeature = featureIndex > 0 ? plan.features[featureIndex - 1] : null;
                          const showCategorySeparator = prevFeature && 
                            feature.category && 
                            prevFeature.category !== feature.category &&
                            feature.category !== 'limits';
                          
                          return (
                            <li key={featureIndex}>
                              {showCategorySeparator && (
                                <div className="my-3 border-t border-border"></div>
                              )}
                              <div className="flex items-start">
                                {feature.included ? (
                                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                                )}
                                <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                                  {feature.text}
                                </span>
                              </div>
                            </li>
                          );
                        })
                      ) : (
                        <li className="text-sm text-muted-foreground">Aucune fonctionnalité disponible</li>
                      )}
                    </ul>
                  </div>

                  <Button
                    className={`w-full ${
                      getCtaColor(plan) === 'orange'
                        ? 'bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white'
                        : getCtaColor(plan) === 'green'
                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    }`}
                    size="lg"
                    asChild
                  >
                    <Link href={plan.priceType === 'custom' || plan.displayName.toLowerCase() === 'enterprise' ? '/contact' : '/auth/sign-up'}>
                      {getCtaText(plan)}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Extranet Limit Section */}
        <div className="bg-muted/50 dark:bg-muted/30 border-y border-border py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground mb-1">Limite extranet locataires</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Tous les plans incluent un nombre défini d'accès extranet pour vos locataires. Surveillez votre utilisation dans le tableau de bord.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Intranet activé</span>
                    <span className="text-muted-foreground">12/50</span>
                  </div>
                  <Progress value={24} className="h-2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Questions fréquentes
            </h2>
            <p className="text-muted-foreground">
              Tout ce que vous devez savoir sur nos plans
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="flex items-center justify-between"
                >
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedFaq === index ? 'transform rotate-180' : ''
                    }`}
                  />
                </CardHeader>
                {expandedFaq === index && (
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Prêt à démarrer avec SYS SAMBA?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Commencez gratuitement, aucune carte de crédit requise
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              {isLoggedIn ? (
                <Button size="lg" variant="secondary" className="bg-white text-foreground hover:bg-gray-100 dark:bg-card dark:text-foreground dark:hover:bg-muted" asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="h-5 w-5 mr-2" />
                    Accéder au tableau de bord
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="secondary" className="bg-white text-foreground hover:bg-gray-100 dark:bg-card dark:text-foreground dark:hover:bg-muted" asChild>
                    <Link href="/auth/sign-up" className="flex items-center">
                      <Send className="h-5 w-5 mr-2" />
                      Essai gratuit 30 jours
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 dark:border-foreground dark:text-foreground dark:hover:bg-foreground/10" asChild>
                    <Link href="/contact" className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      Demander une démo
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm text-white/80">
              Configuration en 5 minutes • Support en français et anglais • Données sécurisées
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-[#1e3a8a] text-white pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
              {/* Brand */}
              <div className="space-y-4">
                <Link href="/" className="flex items-center">
                  <Logo width={180} height={50} className="[&_text]:fill-white" />
                </Link>
                <p className="text-sm text-white/80">
                  sys.samba
                </p>
                <p className="text-sm text-white/80">
                  La plateforme immobilière de référence pour le Sénégal et la zone OHADA. Gestion complète, mobile-first, conforme SYSCOHADA.
                </p>
                <div className="flex gap-3">
                  <a href="#" className="text-white/80 hover:text-white transition-colors">
                    <Linkedin className="h-5 w-5" />
                  </a>
                  <a href="#" className="text-white/80 hover:text-white transition-colors">
                    <Twitter className="h-5 w-5" />
                  </a>
                  <a href="#" className="text-white/80 hover:text-white transition-colors">
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a href="#" className="text-white/80 hover:text-white transition-colors">
                    <Youtube className="h-5 w-5" />
                  </a>
                </div>
              </div>

              {/* Product Links */}
              <div>
                <h4 className="font-bold mb-4">Produit</h4>
                <ul className="space-y-3 text-sm text-white/80">
                  <li><Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
                  <li><Link href="#" className="hover:text-white transition-colors">Sécurité</Link></li>
                  <li><Link href="#" className="hover:text-white transition-colors">Intégrations</Link></li>
                </ul>
              </div>

              {/* Support Links */}
              <div>
                <h4 className="font-bold mb-4">Support</h4>
                <ul className="space-y-3 text-sm text-white/80">
                  <li><Link href="#" className="hover:text-white transition-colors">Centre d'aide</Link></li>
                  <li><Link href="#" className="hover:text-white transition-colors">Documentation</Link></li>
                  <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
                  <li><Link href="#" className="hover:text-white transition-colors">Statut système</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-blue-800 pt-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-white/60">
                    © 2025 SYS SAMBA. Tous droits réservés. Conforme OHADA.
                </p>
                <div className="flex gap-6 text-sm text-white/60">
                  <Link href="#" className="hover:text-white transition-colors">Mentions légales</Link>
                  <Link href="#" className="hover:text-white transition-colors">Confidentialité</Link>
                  <Link href="#" className="hover:text-white transition-colors">CGU</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}