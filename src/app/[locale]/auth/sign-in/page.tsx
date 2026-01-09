'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Mail, Lock, Eye, EyeOff, CheckCircle, Smartphone, CreditCard, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';

// Dynamically import Google sign-in button to prevent hydration issues
const GoogleSignInButton = dynamic(() => import('./components/GoogleSignInButton').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <Button type="button" variant="outline" className="w-full" disabled>
      <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      Chargement...
    </Button>
  ),
});

export default function SignInPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent multiple rapid clicks
    if (loading || rateLimited) {
      return;
    }

    setLoading(true);
    setError('');

    // Validate inputs
    if (!email.trim() && !password.trim()) {
      setError('Veuillez remplir tous les champs');
      setLoading(false);
      return;
    }

    try {
      // Determine if input is email or phone
      const isPhone = /^\+?[0-9\s-]+$/.test(email.trim());
      const credentials = isPhone 
        ? { phone: email.trim(), password }
        : { email: email.trim(), password };

      let response: Response;
      let data: any;

      try {
        response = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Important: include cookies
          body: JSON.stringify(credentials),
        });
      } catch (fetchError: any) {
        // Network error or CORS issue
        console.error('Network error during sign-in:', fetchError);
        setError('Erreur de connexion au serveur. Vérifiez votre connexion internet.');
        setLoading(false);
        return;
      }

      try {
        data = await response.json();
      } catch (jsonError) {
        // Response is not JSON (might be HTML error page)
        console.error('Invalid JSON response:', jsonError);
        setError('Erreur serveur. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMessage = data.error || 'Erreur de connexion';

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfterSeconds = data.retryAfter || 60;
          setRateLimited(true);
          setRetryAfter(retryAfterSeconds);
          setCountdown(retryAfterSeconds);
          setError(`Limite de taux atteinte. Réessayez dans ${retryAfterSeconds} secondes.`);

          // Start countdown timer
          const interval = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                setRateLimited(false);
                setRetryAfter(0);
                setError('');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          // Cleanup interval after timeout
          setTimeout(() => {
            clearInterval(interval);
          }, retryAfterSeconds * 1000);
        } else {
          setError(errorMessage);
        }

        setLoading(false);
        return;
      }

      // Wait a bit to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 300));

      // Determine redirect based on user's status
      let redirectPath: string;
      
      // Check if user is super-admin
      const isSuperAdmin = data.isSuperAdmin || false;
      
      // Check if user is System Administrator (admin)
      const isSystemAdmin = data.isSystemAdmin || false;
      
      // Check if user has an organization
      const hasOrganization = data.hasOrganization || !!data.user?.organizationId;
      
      // Check if organization is configured
      const organizationConfigured = data.organizationConfigured || false;
      
      // Get organization subdomain if available
      const organizationSubdomain = data.organizationSubdomain || null;
      
      // Check for redirect parameter (only if valid)
      const redirectParam = new URLSearchParams(window.location.search).get('redirect');
      const isValidRedirect = redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/auth');
      
      if (isSuperAdmin) {
        // Super admin - always go to /admin
        redirectPath = isValidRedirect ? redirectParam : '/admin';
      } else if (isSystemAdmin && hasOrganization && !organizationConfigured) {
        // System Admin with unconfigured organization - redirect to setup
        redirectPath = '/setup';
      } else if (isSystemAdmin && !hasOrganization) {
        // System Admin without organization - redirect to setup
        redirectPath = '/setup';
      } else {
        // Regular user or admin with configured org - go to dashboard
        redirectPath = isValidRedirect ? redirectParam : '/dashboard';
      }

      // Construct full URL with subdomain if available
      // Check if we're on main domain and need to redirect to subdomain
      const currentHost = window.location.hostname;
      const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
      const isMainDomain = currentHost === MAIN_DOMAIN || currentHost === `www.${MAIN_DOMAIN}`;
      
      let redirectUrl: string;
      
      if (organizationSubdomain && isMainDomain) {
        // User is on main domain and has subdomain - redirect to subdomain
        const protocol = window.location.protocol;
        redirectUrl = `${protocol}//${organizationSubdomain}.${MAIN_DOMAIN}${redirectPath}`;
        console.log(`[Sign In] Redirecting to subdomain: ${redirectUrl}`);
      } else {
        // Use relative path (will work on current domain)
        redirectUrl = redirectPath;
      }

      // Use window.location for a hard redirect to ensure cookies are sent
      // This ensures the middleware and layouts can read the cookies
      window.location.href = redirectUrl;
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Erreur de connexion');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00D4AA] via-[#00A8E8] to-[#00D4AA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-4">
            <Key className="h-8 w-8 text-white" suppressHydrationWarning />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue sur Syssamba</h1>
          <p className="text-white/90">
            Connectez-vous ou créez votre compte pour gérer vos biens immobiliers
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'login'
                  ? 'bg-white text-[#00A8E8] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => router.push('/auth/sign-up')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'bg-white text-[#00A8E8] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email/Phone Input */}
            <div>
              <Label htmlFor="email">Email ou téléphone</Label>
              <div className="relative mt-1">
                <span suppressHydrationWarning>
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" suppressHydrationWarning />
                </span>
                <Input
                  id="email"
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com ou +221 77 123 45 67"
                  className="pl-10"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vous pouvez utiliser votre email ou votre numéro de téléphone
              </p>
            </div>

            {/* Password Input */}
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative mt-1">
                <span suppressHydrationWarning>
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" suppressHydrationWarning />
                </span>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="pl-10 pr-10"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <span suppressHydrationWarning>
                    {showPassword ? <EyeOff className="h-5 w-5" suppressHydrationWarning /> : <Eye className="h-5 w-5" suppressHydrationWarning />}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Se souvenir de moi
                </Label>
              </div>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[#00A8E8] hover:underline font-medium"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            {error && (
              <div className={`text-sm text-center p-3 rounded-md ${rateLimited ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                {error}
                {rateLimited && countdown > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-yellow-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(countdown / retryAfter) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-yellow-600 mt-1">
                      Décompte: {countdown} secondes restantes
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading || rateLimited}
              className="w-full bg-gradient-to-r from-[#00D4AA] to-[#00A8E8] hover:opacity-90 text-white font-semibold py-6 disabled:opacity-50"
            >
              {loading ? 'Connexion...' :
               rateLimited ? `Réessayer dans ${countdown}s` :
               '→ Se connecter'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-muted-foreground">ou continuez avec</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Sign In */}
          <Suspense fallback={
            <Button type="button" variant="outline" className="w-full" disabled>
              <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Chargement...
            </Button>
          }>
            <GoogleSignInButton onClick={handleGoogleSignIn} disabled={loading} />
          </Suspense>
        </Card>

        {/* Features Section */}
        <Card className="mt-6 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⭐</span>
            <h3 className="font-semibold text-foreground">Pourquoi choisir Samba One ?</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-foreground">Conforme SYSCOHADA</p>
                <p className="text-xs text-muted-foreground">
                  Comptabilité automatique selon les normes sénégalaises
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <Smartphone className="h-5 w-5 text-[#00D4AA] mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-foreground">Mobile-first</p>
                <p className="text-xs text-muted-foreground">
                  Gérez vos biens depuis votre smartphone
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <CreditCard className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-foreground">Paiements Wave & Orange Money</p>
                <p className="text-xs text-muted-foreground">
                  Intégration native avec les solutions locales
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-white/90">
            Besoin d'aide?{' '}
            <Link href="/contact" className="text-white hover:underline font-medium">
              Contactez notre équipe
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

