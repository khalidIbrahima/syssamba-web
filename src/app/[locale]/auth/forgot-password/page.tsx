'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Veuillez entrer votre email');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erreur lors de l\'envoi de l\'email');
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00D4AA] via-[#00A8E8] to-[#00D4AA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 text-white hover:text-white/80"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Mot de passe oublié</h1>
          <p className="text-white/90">
            Nous vous enverrons un lien pour réinitialiser votre mot de passe
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-8 shadow-2xl">
          {success ? (
            <>
              <div className="text-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Email envoyé !</h2>
                <p className="text-muted-foreground mb-2">
                  Nous avons envoyé un lien de réinitialisation à <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez votre boîte de réception et suivez les instructions pour réinitialiser votre mot de passe.
                </p>
              </div>
              <Button
                onClick={() => router.push('/auth/sign-in')}
                className="w-full bg-gradient-to-r from-[#00D4AA] to-[#00A8E8] hover:opacity-90 text-white font-semibold"
              >
                Retour à la connexion
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">Réinitialiser le mot de passe</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Entrez votre adresse email et nous vous enverrons un lien de réinitialisation
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                {/* Email Input */}
                <div>
                  <Label htmlFor="email">Adresse email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-md">
                    {error}
                  </div>
                )}

                {/* Reset Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#00D4AA] to-[#00A8E8] hover:opacity-90 text-white font-semibold py-6"
                >
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </Button>
              </form>

              {/* Back to Sign In */}
              <div className="text-center mt-6">
                <Link
                  href="/auth/sign-in"
                  className="text-sm text-[#00A8E8] hover:underline font-medium"
                >
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

