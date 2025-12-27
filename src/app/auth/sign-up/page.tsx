'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle, Smartphone, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

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

      // Redirect to dashboard or the redirect URL from query params
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
      router.push(redirectUrl);
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-4">
            <Key className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenue sur SysSamba</h1>
          <p className="text-white/90">
            Créez votre compte pour gérer vos biens immobiliers
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Créer un compte</h2>
          <p className="text-sm text-gray-600 mb-6">
            Remplissez les informations ci-dessous
          </p>

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName">Prénom *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                    : 'text-gray-600 hover:text-gray-900'
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
                    : 'text-gray-600 hover:text-gray-900'
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
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                <span className="text-sm text-gray-500">ou continuez avec</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google Sign Up */}
              <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignUp}
            className="w-full"
            disabled={loading}
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
            </>
          )}

          {/* Sign In Link */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
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
                <p className="font-medium text-sm text-gray-900">Conforme SYSCOHADA</p>
                <p className="text-xs text-gray-600">
                  Comptabilité automatique selon les normes sénégalaises
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-[#00D4AA] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-900">Mobile-first</p>
                <p className="text-xs text-gray-600">
                  Gérez vos biens depuis votre smartphone
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-900">Paiements Wave & Orange Money</p>
                <p className="text-xs text-gray-600">
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

