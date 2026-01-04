'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  MessageSquare,
  Filter,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Ticket,
  User,
  Building2,
} from 'lucide-react';
import { useDataQuery } from '@/hooks/use-query';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/page-loader';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Fetch tickets
async function getTickets(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  organizationId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.organizationId) params.append('organizationId', filters.organizationId);

  const response = await fetch(`/api/support/tickets?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }

  return response.json();
}

// Update ticket
async function updateTicket(ticketId: string, updates: any) {
  const response = await fetch(`/api/support/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update ticket');
  }

  return response.json();
}

// Get ticket details
async function getTicketDetails(ticketId: string) {
  const response = await fetch(`/api/support/tickets/${ticketId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch ticket details');
  }

  return response.json();
}

export default function SupportTicketsPage() {
  const [filters, setFilters] = useState<{
    status?: string;
    priority?: string;
    category?: string;
    organizationId?: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);

  const { data: ticketsData, isLoading, error, refetch } = useDataQuery(
    ['support-tickets', filters],
    () => getTickets(filters)
  );
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();

  const tickets = ticketsData?.tickets || [];

  // Filter tickets by search term
  const filteredTickets = useMemo(() => {
    if (!searchTerm) return tickets;

    const term = searchTerm.toLowerCase();
    return tickets.filter((ticket: any) =>
      ticket.subject?.toLowerCase().includes(term) ||
      ticket.description?.toLowerCase().includes(term) ||
      ticket.ticket_number?.toLowerCase().includes(term)
    );
  }, [tickets, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t: any) => t.status === 'open').length,
      inProgress: tickets.filter((t: any) => t.status === 'in_progress').length,
      resolved: tickets.filter((t: any) => t.status === 'resolved').length,
      urgent: tickets.filter((t: any) => t.priority === 'urgent' || t.priority === 'critical').length,
    };
  }, [tickets]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      open: { variant: 'default', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
      in_progress: { variant: 'default', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' },
      waiting_customer: { variant: 'outline', className: 'bg-muted text-foreground border-border' },
      resolved: { variant: 'default', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800' },
      closed: { variant: 'secondary', className: 'bg-muted text-muted-foreground border-border' },
      cancelled: { variant: 'destructive', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800' },
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
      low: { className: 'bg-muted text-foreground border-border' },
      medium: { className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
      high: { className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
      urgent: { className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800' },
      critical: { className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
    };

    const config = variants[priority] || variants.medium;
    return (
      <Badge className={config.className}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const handleViewTicket = async (ticket: any) => {
    try {
      const data = await getTicketDetails(ticket.id);
      setSelectedTicket(data);
      setViewDialogOpen(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load ticket details');
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    setUpdatingTicket(ticketId);
    try {
      await updateTicket(ticketId, { status });
      toast.success('Ticket status updated');
      refetch();
      if (selectedTicket?.ticket?.id === ticketId) {
        const data = await getTicketDetails(ticketId);
        setSelectedTicket(data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicket(null);
    }
  };

  const handleUpdatePriority = async (ticketId: string, priority: string) => {
    setUpdatingTicket(ticketId);
    try {
      await updateTicket(ticketId, { priority });
      toast.success('Ticket priority updated');
      refetch();
      if (selectedTicket?.ticket?.id === ticketId) {
        const data = await getTicketDetails(ticketId);
        setSelectedTicket(data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicket(null);
    }
  };

  if (isSuperAdminLoading || isLoading) {
    return <PageLoader />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600 font-semibold mb-2">Accès refusé</p>
              <p className="text-muted-foreground text-sm">Seuls les super-administrateurs peuvent accéder à cette page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600 font-semibold mb-2">Erreur lors du chargement</p>
              <p className="text-muted-foreground text-sm">{error.message}</p>
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Ticket className="h-8 w-8 text-muted-foreground" />
            Tickets de Support
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez tous les tickets de support créés par les administrateurs d'organisation
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <Ticket className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ouverts</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{stats.open}</p>
              </div>
              <Clock className="h-10 w-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En cours</p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">{stats.inProgress}</p>
              </div>
              <Loader2 className="h-10 w-10 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Résolus</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urgents</p>
                <p className="text-3xl font-bold text-red-900 mt-1">{stats.urgent}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par sujet, description ou numéro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  status: value === 'all' ? undefined : value,
                }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="waiting_customer">En attente client</SelectItem>
                <SelectItem value="resolved">Résolu</SelectItem>
                <SelectItem value="closed">Fermé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  priority: value === 'all' ? undefined : value,
                }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les priorités</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Élevée</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.category || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  category: value === 'all' ? undefined : value,
                }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                <SelectItem value="technical">Technique</SelectItem>
                <SelectItem value="billing">Facturation</SelectItem>
                <SelectItem value="feature_request">Demande de fonctionnalité</SelectItem>
                <SelectItem value="bug_report">Rapport de bug</SelectItem>
                <SelectItem value="account">Compte</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>

            {(filters.status || filters.priority || filters.category) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({})}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets ({filteredTickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun ticket trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket: any) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate" title={ticket.subject}>
                          {ticket.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{ticket.organization_id?.substring(0, 8)}...</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>
                        {ticket.category ? (
                          <Badge variant="outline">{ticket.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTicket(ticket)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Ticket Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket?.ticket?.ticket_number} - {selectedTicket?.ticket?.subject}
            </DialogTitle>
            <DialogDescription>
              Détails du ticket de support
            </DialogDescription>
          </DialogHeader>

          {selectedTicket?.ticket && (
            <div className="space-y-6 mt-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statut</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedTicket.ticket.status)}
                  </div>
                </div>
                <div>
                  <Label>Priorité</Label>
                  <div className="mt-1">
                    {getPriorityBadge(selectedTicket.ticket.priority)}
                  </div>
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <div className="mt-1">
                    {selectedTicket.ticket.category || '-'}
                  </div>
                </div>
                <div>
                  <Label>Créé le</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(selectedTicket.ticket.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.ticket.description}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={selectedTicket.ticket.status}
                  onValueChange={(value) => handleUpdateStatus(selectedTicket.ticket.id, value)}
                  disabled={updatingTicket === selectedTicket.ticket.id}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Ouvert</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="waiting_customer">En attente client</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                    <SelectItem value="closed">Fermé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedTicket.ticket.priority}
                  onValueChange={(value) => handleUpdatePriority(selectedTicket.ticket.id, value)}
                  disabled={updatingTicket === selectedTicket.ticket.id}
                >
                  <SelectTrigger className="w-[200px]">
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

              {/* Comments */}
              {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                <div>
                  <Label>Commentaires</Label>
                  <div className="mt-2 space-y-3">
                    {selectedTicket.comments.map((comment: any) => (
                      <div key={comment.id} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {comment.created_by ? `User ${comment.created_by.substring(0, 8)}` : 'System'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-sm">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

