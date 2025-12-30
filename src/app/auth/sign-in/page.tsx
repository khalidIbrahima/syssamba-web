'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Mail, Lock, Eye, EyeOff, CheckCircle, Smartphone, CreditCard, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

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

      // Determine redirect based on user's organization status
      let redirectUrl: string;
      
      // Check if user is super-admin or has admin role
      const isSuperAdmin = data.isSuperAdmin || false;
      const isAdmin = data.user?.role === 'admin' || isSuperAdmin;
      
      // Check if user has an organization and if it's configured
      const hasOrganization = data.hasOrganization || data.user?.organizationId;
      const isOrganizationConfigured = data.organizationConfigured !== false;
      
      if (isAdmin) {
        // Admin/Super-admin without organization should select one (for super-admin)
        if (isSuperAdmin && !hasOrganization) {
          redirectUrl = '/admin/select-organization';
        } else {
          // Admin/Super-admin - go to /admin or custom redirect
          const redirectParam = new URLSearchParams(window.location.search).get('redirect');
          if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/auth')) {
            redirectUrl = redirectParam;
          } else {
            redirectUrl = '/admin'; // Default page for admin users
          }
        }
      } else if (!hasOrganization) {
        // Regular user: no organization - redirect to setup
        redirectUrl = '/setup';
      } else {
        // Regular user: has organization - redirect to dashboard (don't check if configured)
        // Regular user: has configured organization - check if there's a redirect param, otherwise go to dashboard
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        // Only use redirect param if it's a valid internal route
        if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/auth')) {
          redirectUrl = redirectParam;
        } else {
          redirectUrl = '/dashboard';
        }
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
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue sur SysSamba</h1>
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
                  : 'text-gray-600 hover:text-gray-900'
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
                  : 'text-gray-600 hover:text-gray-900'
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
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" suppressHydrationWarning />
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
              <p className="text-xs text-gray-500 mt-1">
                Vous pouvez utiliser votre email ou votre numéro de téléphone
              </p>
            </div>

            {/* Password Input */}
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative mt-1">
                <span suppressHydrationWarning>
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" suppressHydrationWarning />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <span className="text-sm text-gray-500">ou continuez avec</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            className="w-full"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
        </Card>

        {/* Features Section */}
        <Card className="mt-6 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⭐</span>
            <h3 className="font-semibold text-gray-900">Pourquoi choisir Samba One ?</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-gray-900">Conforme SYSCOHADA</p>
                <p className="text-xs text-gray-600">
                  Comptabilité automatique selon les normes sénégalaises
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <Smartphone className="h-5 w-5 text-[#00D4AA] mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-gray-900">Mobile-first</p>
                <p className="text-xs text-gray-600">
                  Gérez vos biens depuis votre smartphone
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span suppressHydrationWarning>
                <CreditCard className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" suppressHydrationWarning />
              </span>
              <div>
                <p className="font-medium text-sm text-gray-900">Paiements Wave & Orange Money</p>
                <p className="text-xs text-gray-600">
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

