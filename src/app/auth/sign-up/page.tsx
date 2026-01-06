'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, Smartphone, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { Logo } from '@/components/logo';

// Dynamically import Google sign-in button to prevent hydration issues
const GoogleSignInButton = dynamic(() => import('../sign-in/components/GoogleSignInButton').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <Button type="button" variant="outline" className="w-full" disabled>
      <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      Chargement...
    </Button>
  ),
});

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usePhone, setUsePhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    setError('');

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez remplir tous les champs obligatoires');
      setLoading(false);
      return;
    }

    if (!email && !phone) {
      setError('Veuillez entrer un email ou un numéro de téléphone');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: usePhone ? undefined : email,
          phone: usePhone ? phone : undefined,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erreur lors de l\'inscription');
        setLoading(false);
        return;
      }

      // Redirect to setup page for new users (organization is not configured yet)
      // The setup page will allow them to complete organization info and select a plan
      router.push('/setup');
      router.refresh();
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Erreur lors de l\'inscription');
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if Google OAuth is configured
    try {
      window.location.href = '/api/auth/google';
    } catch (err) {
      console.error('Google sign up error:', err);
      setError('Erreur lors de la connexion Google. Veuillez utiliser le formulaire d\'inscription.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00D4AA] via-[#00A8E8] to-[#00D4AA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo width={200} height={60} className="[&_text]:fill-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue sur SYSSAMBA</h1>
          <p className="text-white/90">
            Créez votre compte pour gérer vos biens immobiliers
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-foreground mb-2">Créer un compte</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Remplissez les informations ci-dessous
          </p>

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName">Prénom *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Votre prénom"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Nom *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Votre nom"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Email/Phone Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setUsePhone(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !usePhone
                    ? 'bg-white text-[#00A8E8] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setUsePhone(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  usePhone
                    ? 'bg-white text-[#00A8E8] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Téléphone
              </button>
            </div>

            {/* Email or Phone Input */}
            {!usePhone ? (
              <div>
                <Label htmlFor="email">Email *</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="phone">Téléphone *</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+221 77 123 45 67"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <Label htmlFor="password">Mot de passe *</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Sign Up Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#00D4AA] to-[#00A8E8] hover:opacity-90 text-white font-semibold py-6"
            >
              {loading ? 'Inscription...' : '→ Créer mon compte'}
            </Button>
          </form>

          {/* OAuth Sign Up - Temporarily disabled to fix Microsoft redirect issue */}
          {/* TODO: Re-enable when Google OAuth is properly configured in Supabase */}
          {false && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-muted-foreground">ou continuez avec</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google Sign Up */}
              <Suspense fallback={
            <Button type="button" variant="outline" className="w-full" disabled>
              <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Chargement...
            </Button>
          }>
            <GoogleSignInButton onClick={handleGoogleSignUp} disabled={loading} />
          </Suspense>
            </>
          )}

          {/* Sign In Link */}
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link href="/auth/sign-in" className="text-[#00A8E8] hover:underline font-medium">
                Se connecter
              </Link>
            </p>
          </div>
        </Card>

        {/* Features Section */}
        <div className="mt-6 space-y-3">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-foreground">Conforme SYSCOHADA</p>
                <p className="text-xs text-muted-foreground">
                  Comptabilité automatique selon les normes sénégalaises
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-[#00D4AA] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-foreground">Mobile-first</p>
                <p className="text-xs text-muted-foreground">
                  Gérez vos biens depuis votre smartphone
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-foreground">Paiements Wave & Orange Money</p>
                <p className="text-xs text-muted-foreground">
                  Intégration native avec les solutions locales
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

