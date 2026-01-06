/**
 * Script batch pour mettre à jour le statut des souscriptions expirées
 * 
 * Ce script peut être exécuté via:
 * - Cron job (recommandé: quotidien)
 * - Task scheduler
 * - API endpoint (pour exécution manuelle)
 * 
 * Usage:
 *   npx tsx scripts/update-expired-subscriptions.ts
 */

import { db } from '../src/lib/db';
import { sendBulkEmail, generateSubscriptionExpiredEmail } from '../src/lib/email';

interface UpdateResult {
  updatedCount: number;
  subscriptionIds: string[];
  emailsSent: number;
}

/**
 * Met à jour les souscriptions expirées depuis plus de 5 jours
 */
async function updateExpiredSubscriptions(): Promise<UpdateResult> {
  try {
    console.log('🔄 Début de la mise à jour des souscriptions expirées...');
    console.log(`📅 Date actuelle: ${new Date().toISOString()}`);

    // Récupérer toutes les souscriptions actives, en essai, ou en retard
    const subscriptions = await db.select<{
      id: string;
      organization_id: string;
      plan_id: string;
      status: string;
      current_period_end: Date | string;
      end_date: Date | string | null;
      cancel_at_period_end: boolean;
      canceled_at: Date | string | null;
    }>('subscriptions', {
      in: { status: ['active', 'trialing', 'past_due'] },
    });

    console.log(`📊 Souscriptions à vérifier: ${subscriptions.length}`);

    const updatedIds: string[] = [];
    const now = new Date();
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Structure pour stocker les informations nécessaires pour l'envoi d'emails
    interface SubscriptionUpdate {
      subscriptionId: string;
      organizationId: string;
      organizationName: string;
      planName: string;
      expirationDate: Date;
      newStatus: 'expired' | 'canceled';
    }

    const subscriptionsToNotify: SubscriptionUpdate[] = [];

    for (const sub of subscriptions) {
      // Déterminer la date d'expiration effective
      let expirationDate: Date | null = null;

      if (sub.cancel_at_period_end) {
        // Si annulation programmée, utiliser current_period_end
        expirationDate = sub.current_period_end instanceof Date 
          ? sub.current_period_end 
          : new Date(sub.current_period_end);
      } else if (sub.end_date) {
        // Sinon, utiliser end_date si elle existe
        expirationDate = sub.end_date instanceof Date 
          ? sub.end_date 
          : new Date(sub.end_date);
      } else {
        // Sinon, utiliser current_period_end
        expirationDate = sub.current_period_end instanceof Date 
          ? sub.current_period_end 
          : new Date(sub.current_period_end);
      }

      // Vérifier si la date d'expiration est dépassée depuis plus de 5 jours
      if (expirationDate < fiveDaysAgo) {
        // Déterminer le nouveau statut
        const newStatus = (sub.cancel_at_period_end || sub.canceled_at) 
          ? 'canceled' 
          : 'expired';

        // Récupérer les informations de l'organisation
        const organization = await db.selectOne<{
          id: string;
          name: string | null;
        }>('organizations', {
          eq: { id: sub.organization_id },
        });

        // Récupérer les informations du plan
        const plan = await db.selectOne<{
          id: string;
          name: string;
          display_name: string | null;
        }>('plans', {
          eq: { id: sub.plan_id },
        });

        // Mettre à jour la souscription
        await db.updateOne('subscriptions', {
          status: newStatus,
          end_date: sub.end_date || expirationDate.toISOString().split('T')[0],
          updated_at: now,
        }, { id: sub.id });

        updatedIds.push(sub.id);
        console.log(`✅ Souscription ${sub.id} mise à jour: ${sub.status} → ${newStatus} (expirée le ${expirationDate.toISOString().split('T')[0]})`);

        // Stocker les informations pour l'envoi d'email
        if (organization && plan) {
          subscriptionsToNotify.push({
            subscriptionId: sub.id,
            organizationId: sub.organization_id,
            organizationName: organization.name || 'Votre organisation',
            planName: plan.display_name || plan.name,
            expirationDate,
            newStatus,
          });
        }
      }
    }

    console.log(`\n✨ Mise à jour terminée: ${updatedIds.length} souscription(s) mise(s) à jour`);
    
    if (updatedIds.length > 0) {
      console.log(`📋 IDs des souscriptions mises à jour:`, updatedIds);
    }

    // Envoyer des emails aux admins des organisations concernées
    let emailsSent = 0;
    if (subscriptionsToNotify.length > 0) {
      console.log(`\n📧 Envoi des notifications par email aux admins...`);
      
      for (const subUpdate of subscriptionsToNotify) {
        try {
          // Récupérer les admins de l'organisation (owner et admin)
          const admins = await db.select<{
            id: string;
            email: string | null;
            first_name: string | null;
            last_name: string | null;
            role: string;
          }>('users', {
            eq: { organization_id: subUpdate.organizationId },
            in: { role: ['owner', 'admin'] },
          });

          // Filtrer les admins avec un email valide
          const adminEmails = admins
            .filter(admin => admin.email && admin.email.trim() !== '')
            .map(admin => admin.email!);

          if (adminEmails.length > 0) {
            // Générer l'email
            const emailContent = generateSubscriptionExpiredEmail({
              organizationName: subUpdate.organizationName,
              planName: subUpdate.planName,
              expirationDate: subUpdate.expirationDate.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              status: subUpdate.newStatus,
            });

            // Envoyer l'email à tous les admins
            const emailResults = await sendBulkEmail(
              adminEmails,
              emailContent.subject,
              emailContent.html,
              emailContent.text
            );

            const successCount = emailResults.filter(r => r.success).length;
            emailsSent += successCount;

            console.log(`  📨 Email envoyé à ${successCount}/${adminEmails.length} admin(s) de ${subUpdate.organizationName}`);
            
            if (successCount < adminEmails.length) {
              const failed = emailResults.filter(r => !r.success);
              console.warn(`  ⚠️  Échec d'envoi pour ${failed.length} email(s):`, failed.map(f => f.error));
            }
          } else {
            console.warn(`  ⚠️  Aucun admin avec email valide trouvé pour l'organisation ${subUpdate.organizationName}`);
          }
        } catch (error) {
          console.error(`  ❌ Erreur lors de l'envoi d'email pour l'organisation ${subUpdate.organizationName}:`, error);
        }
      }
      
      console.log(`\n📧 Total: ${emailsSent} email(s) envoyé(s)`);
    }

    return {
      updatedCount: updatedIds.length,
      subscriptionIds: updatedIds,
      emailsSent,
    };
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des souscriptions:', error);
    throw error;
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  updateExpiredSubscriptions()
    .then((result) => {
      console.log('\n📊 Résultat:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

export { updateExpiredSubscriptions };

