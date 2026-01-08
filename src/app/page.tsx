import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { isSuperAdmin } from '@/lib/super-admin';
import {
  Building2,
  Check,
  Play,
  Phone,
  Mail,
  MapPin,
  Linkedin,
  Facebook,
  Twitter,
  ChevronDown,
  Clock,
  LayoutDashboard
} from 'lucide-react';

const stats = [
  { label: 'Lots gérés', value: '2,500+', color: 'text-blue-600' },
  { label: 'Agences partenaires', value: '150+', color: 'text-green-600' },
  { label: 'Taux de satisfaction', value: '98%', color: 'text-yellow-500' },
  { label: 'Support client', value: '24/7', color: 'text-red-500' },
];

export default async function Home() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  
  // Check if user is super admin and redirect to admin dashboard
  if (user) {
    const userIsSuperAdmin = await isSuperAdmin(user.id);
    if (userIsSuperAdmin) {
      // Redirect to admin dashboard for super admin
      const { redirect } = await import('next/navigation');
      redirect('/admin/dashboard');
      return null; // Prevent rendering the landing page
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-white z-50 h-20 flex items-center shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Logo width={180} height={50} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
            <Link href="#features" className="hover:text-blue-600 transition-colors font-semibold">Fonctionnalités</Link>
            <Link href="/pricing" className="hover:text-blue-600 transition-colors font-semibold">Tarifs</Link>
            <Link href="#about" className="hover:text-blue-600 transition-colors font-semibold">À propos</Link>
            <Link href="#contact" className="hover:text-blue-600 transition-colors font-semibold">Contact</Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="hidden md:flex items-center border border-gray-200 rounded-md px-1 py-1 bg-white overflow-hidden">
              <button className="px-2 py-1 text-xs font-bold text-white bg-blue-600">FR</button>
              <button className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900">EN</button>
              <button className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900">WO</button>
            </div>

            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Button variant="outline" className="hidden sm:flex items-center gap-2" asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-4 w-4" />
                      Tableau de bord
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/sign-in" className="text-sm font-semibold text-gray-700 hover:text-blue-600 hidden sm:block">
                    Connexion
                  </Link>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6" asChild>
                    <Link href="/auth/sign-up">
                      Essai gratuit
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 min-h-[90vh] flex flex-col bg-[#1e3a8a] overflow-hidden">
        {/* Background Image - Coastal city at sunset */}
        {/* 
          Pour utiliser votre propre image :
          1. Placez votre image dans public/hero-cover.jpg
          2. Remplacez l'URL ci-dessous par "/hero-cover.jpg"
        */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
            alt="Vue aérienne de Dakar au coucher du soleil"
            fill
            priority
            className="object-cover"
            style={{
              filter: 'blur(1px) brightness(0.6) saturate(1.2)',
            }}
            quality={90}
          />
        </div>
        
        {/* Gradient overlay for better text readability - preserves sunset colors */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/90 via-blue-800/80 to-blue-900/90"></div>
        
        {/* Additional warm overlay to blend sunset with blue theme */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/15 via-transparent to-blue-900/35"></div>

        <div className="relative z-10 flex-grow flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Content */}
              <div className="text-white space-y-8 max-w-2xl">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight drop-shadow-lg">
                  Gérez vos lots immobiliers <span className="text-yellow-300 drop-shadow-md">en 30 secondes</span>
                </h1>
                
                <p className="text-lg md:text-xl text-white font-medium leading-relaxed max-w-xl drop-shadow-md">
                  La première plateforme SaaS dédiée à l'immobilier sénégalais. Simplifiez la gestion de vos biens, automatisez vos paiements et développez votre portefeuille immobilier.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  {isLoggedIn ? (
                    <Button className="bg-yellow-400 hover:bg-yellow-500 text-foreground font-bold text-lg h-14 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg" asChild>
                      <Link href="/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-5 w-5" />
                        Accéder au tableau de bord
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button className="bg-yellow-400 hover:bg-yellow-500 text-foreground font-bold text-lg h-14 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg" asChild>
                        <Link href="/auth/sign-up" className="flex items-center">
                          <span className="mr-2">🚀</span>
                          Commencer gratuitement
                        </Link>
                      </Button>
                      
                      <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 hover:text-white h-14 px-8 rounded-lg text-lg font-bold bg-transparent" asChild>
                        <Link href="#demo" className="flex items-center">
                          <Play className="mr-2 h-5 w-5 fill-current" />
                          Voir la démo
                        </Link>
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-6 text-sm font-bold text-white pt-4 drop-shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-0.5 shadow-md">
                      <Check className="h-3 w-3 text-white" strokeWidth={4} />
                    </div>
                    Essai gratuit 30 jours
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-0.5 shadow-md">
                      <Check className="h-3 w-3 text-white" strokeWidth={4} />
                    </div>
                    Conforme SYSCOHADA
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-green-500 rounded-full p-0.5 shadow-md">
                      <Check className="h-3 w-3 text-white" strokeWidth={4} />
                    </div>
                    Mobile-first
                  </div>
                </div>
              </div>

              {/* Right Content - Floating Card */}
              <div className="relative w-full max-w-md mx-auto lg:ml-auto">
                <div className="bg-blue-600/60 backdrop-blur-md border border-blue-400/50 rounded-2xl p-6 md:p-8 shadow-2xl">
                  <h3 className="text-xl md:text-2xl font-bold text-white text-center mb-8 drop-shadow-md">
                    Démarrez en 30 secondes
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="group bg-white/20 hover:bg-white/30 transition-colors rounded-xl p-4 flex gap-4 items-center border border-white/30 shadow-md">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-gray-900 font-bold text-lg shadow-md">
                        1
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-base drop-shadow-sm">Créez votre compte</h4>
                        <p className="text-white/95 text-sm drop-shadow-sm">Email ou téléphone</p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="group bg-white/20 hover:bg-white/30 transition-colors rounded-xl p-4 flex gap-4 items-center border border-white/30 shadow-md">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-gray-900 font-bold text-lg shadow-md">
                        2
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-base drop-shadow-sm">Ajoutez vos biens</h4>
                        <p className="text-white/95 text-sm drop-shadow-sm">Import Excel ou saisie manuelle</p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="group bg-white/20 hover:bg-white/30 transition-colors rounded-xl p-4 flex gap-4 items-center border border-white/30 shadow-md">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-gray-900 font-bold text-lg shadow-md">
                        3
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-base drop-shadow-sm">Gérez automatiquement</h4>
                        <p className="text-white/95 text-sm drop-shadow-sm">Loyers, quittances, comptabilité</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <Button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-14 text-lg shadow-lg rounded-xl transition-all transform hover:-translate-y-0.5" asChild>
                      <Link href={isLoggedIn ? "/dashboard" : "/auth/sign-up"} className="flex items-center justify-center">
                        {isLoggedIn ? (
                          <>
                            <LayoutDashboard className="mr-2 h-5 w-5" />
                            Accéder au tableau de bord
                          </>
                        ) : (
                          <>
                            <Clock className="mr-2 h-5 w-5" />
                            Gérer mes lots maintenant
                          </>
                        )}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Chevron */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
          <ChevronDown className="h-8 w-8 text-white drop-shadow-lg animate-bounce" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-blue-100 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className={`text-4xl md:text-5xl font-extrabold mb-2 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-gray-700 font-semibold text-sm md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1e3a8a] text-white pt-20 pb-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Brand */}
            <div className="space-y-6">
              <Link href="/" className="flex items-center">
                <Logo width={180} height={50} className="[&_text]:fill-white" />
              </Link>
              <p className="text-white/80 text-sm leading-relaxed max-w-xs">
                La solution immobilière de référence pour l'Afrique de l'Ouest.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-blue-700">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-blue-700">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-blue-700">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-lg font-bold mb-6 text-white">Produit</h4>
              <ul className="space-y-4 text-sm text-white/80">
                <li><Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Intégrations</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-lg font-bold mb-6 text-white">Support</h4>
              <ul className="space-y-4 text-sm text-white/80">
                <li><Link href="#" className="hover:text-white transition-colors">Centre d'aide</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Formation</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-lg font-bold mb-6 text-white">Contact</h4>
              <ul className="space-y-4 text-sm text-white/80">
                <li className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>+221 33 123 45 67</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <a href="mailto:contact@sambaone.sn" className="hover:text-white transition-colors">contact@sambaone.sn</a>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>Dakar, Sénégal</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-blue-800 pt-8 text-center text-white/60 text-sm">
            <p>© 2025 Sys Samba. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}