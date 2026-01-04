'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ticket,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDataQuery } from '@/hooks/use-query';
import { PageLoader } from '@/components/ui/page-loader';
import { usePageAccess } from '@/hooks/use-page-access';
import { Badge } from '@/components/ui/badge';

// Create ticket
async function createTicket(data: {
  subject: string;
  description: string;
  priority: string;
  category?: string;
  type?: string;
}) {
  const response = await fetch('/api/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create ticket');
  }

  return response.json();
}

// Get user's tickets
async function getMyTickets() {
  const response = await fetch('/api/support/tickets', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }

  return response.json();
}

export default function SupportPage() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent' | 'critical'>('medium');
  const [category, setCategory] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: ticketsData, isLoading, refetch } = useDataQuery(
    ['my-support-tickets'],
    getMyTickets
  );
  const { isLoading: isPageAccessLoading } = usePageAccess();

  const tickets = ticketsData?.tickets || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !description.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setCreating(true);
    try {
      const result = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category: category || undefined,
        type: type || undefined,
      });

      toast.success(`Ticket créé avec succès: ${result.ticket.ticket_number}`);
      setSubject('');
      setDescription('');
      setPriority('medium');
      setCategory('');
      setType('');
      setShowForm(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Échec de la création du ticket');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string }> = {
      open: { className: 'bg-blue-100 text-blue-800 border-blue-200' },
      in_progress: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      waiting_customer: { className: 'bg-gray-100 text-foreground border-gray-200' },
      resolved: { className: 'bg-green-100 text-green-800 border-green-200' },
      closed: { className: 'bg-gray-100 text-muted-foreground border-gray-200' },
      cancelled: { className: 'bg-red-100 text-red-800 border-red-200' },
    };

    const config = variants[status] || variants.open;
    return (
      <Badge className={config.className}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { className: string }> = {
      low: { className: 'bg-gray-100 text-foreground border-gray-200' },
      medium: { className: 'bg-blue-100 text-blue-800 border-blue-200' },
      high: { className: 'bg-orange-100 text-orange-800 border-orange-200' },
      urgent: { className: 'bg-red-100 text-red-800 border-red-200' },
      critical: { className: 'bg-purple-100 text-purple-800 border-purple-200' },
    };

    const config = variants[priority] || variants.medium;
    return (
      <Badge className={config.className}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (isPageAccessLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            Support
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez un ticket de support ou consultez vos tickets existants
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          {showForm ? (
            <>
              <AlertCircle className="h-4 w-4" />
              Annuler
            </>
          ) : (
            <>
              <Ticket className="h-4 w-4" />
              Nouveau ticket
            </>
          )}
        </Button>
      </div>

      {/* Create Ticket Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Créer un nouveau ticket</CardTitle>
            <CardDescription>
              Décrivez votre problème ou votre demande. Notre équipe vous répondra dans les plus brefs délais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Sujet <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Résumé de votre problème ou demande"
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez en détail votre problème ou votre demande..."
                  required
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorité</Label>
                  <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Élevée</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Select 
                    value={category || '__none__'} 
                    onValueChange={(value) => setCategory(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      <SelectItem value="technical">Technique</SelectItem>
                      <SelectItem value="billing">Facturation</SelectItem>
                      <SelectItem value="feature_request">Demande de fonctionnalité</SelectItem>
                      <SelectItem value="bug_report">Rapport de bug</SelectItem>
                      <SelectItem value="account">Compte</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={type || '__none__'} 
                    onValueChange={(value) => setType(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="issue">Problème</SelectItem>
                      <SelectItem value="request">Demande</SelectItem>
                      <SelectItem value="complaint">Réclamation</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={creating}
                  className="flex-1 gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Créer le ticket
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setSubject('');
                    setDescription('');
                    setPriority('medium');
                    setCategory('');
                    setType('');
                  }}
                  disabled={creating}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* My Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Mes tickets ({tickets.length})</CardTitle>
          <CardDescription>
            Liste de tous vos tickets de support
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Aucun ticket créé</p>
              <p className="text-sm text-muted-foreground">
                Créez votre premier ticket pour obtenir de l'aide
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket: any) => (
                <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-semibold text-muted-foreground">
                            {ticket.ticket_number}
                          </span>
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">
                          {ticket.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(ticket.created_at).toLocaleString('fr-FR')}
                          </div>
                          {ticket.category && (
                            <Badge variant="outline" className="text-xs">
                              {ticket.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

