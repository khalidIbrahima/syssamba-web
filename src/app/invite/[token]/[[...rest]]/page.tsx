'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertTriangle, Loader2 } from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Fetch invitation details
async function getInvitation(token: string) {
  const response = await fetch(`/api/invite/${token}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch invitation');
  }
  return response.json();
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { data, isLoading, error } = useDataQuery(
    ['invitation', token],
    () => getInvitation(token),
    { enabled: !!token }
  );

  const invitation = data?.invitation;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Invitation invalide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {error instanceof Error ? error.message : 'Cette invitation n\'existe pas ou a expiré.'}
              </AlertDescription>
            </Alert>
            <Button
              className="w-full mt-4"
              onClick={() => router.push('/')}
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Invitation Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Invitation à rejoindre {invitation.organizationName}</CardTitle>
                <CardDescription>
                  Vous avez été invité à rejoindre cette organisation en tant que{' '}
                  <span className="font-semibold capitalize">{invitation.role}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Email:</span> {invitation.email}
              </div>
              {invitation.firstName && invitation.lastName && (
                <div>
                  <span className="font-medium">Nom:</span> {invitation.firstName} {invitation.lastName}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sign Up Form */}
        <Card>
          <CardHeader>
            <CardTitle>Créer votre compte</CardTitle>
            <CardDescription>
              Créez votre compte pour accepter l'invitation et accéder à l'organisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;

                try {
                  const response = await fetch('/api/auth/sign-up', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      email,
                      password,
                      firstName,
                      lastName,
                    }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    throw new Error(data.error || 'Erreur lors de l\'inscription');
                  }

                  // Redirect to complete page
                  router.push(`/invite/${token}/complete`);
                } catch (error: any) {
                  toast.error(error.message || 'Erreur lors de l\'inscription');
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={invitation.firstName || ''}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={invitation.lastName || ''}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={invitation.email}
                  required
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full">
                Créer mon compte
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                <p>Vous avez déjà un compte ?</p>
                <Link
                  href={`/auth/sign-in?redirect=/invite/${token}/complete`}
                  className="text-blue-600 hover:underline"
                >
                  Se connecter
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

