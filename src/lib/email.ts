/**
 * Email service
 * Handles sending emails to users
 * Supports multiple email providers (Resend, SMTP, etc.)
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email using configured provider
 * Currently supports:
 * - Resend (via RESEND_API_KEY)
 * - SMTP (via SMTP_* env vars)
 * - Console logging (fallback in development)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, text, from } = options;
  
  // Default from address
  const fromAddress = from || process.env.EMAIL_FROM || 'noreply@syssamba.com';
  
  // Convert to array if single email
  const recipients = Array.isArray(to) ? to : [to];
  
  // Try Resend first (recommended for production)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = await import('resend');
      const resendClient = new resend.Resend(process.env.RESEND_API_KEY);
      
      const { data, error } = await resendClient.emails.send({
        from: fromAddress,
        to: recipients,
        subject,
        html,
        text: text || stripHtml(html),
      });
      
      if (error) {
        console.error('Resend error:', error);
        throw error;
      }
      
      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error: any) {
      console.error('Failed to send email via Resend:', error);
      // Fall through to next method
    }
  }
  
  // Try SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipients.join(', '),
        subject,
        html,
        text: text || stripHtml(html),
      });
      
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error('Failed to send email via SMTP:', error);
      // Fall through to console logging
    }
  }
  
  // Fallback: log to console (development mode)
  if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_FROM) {
    console.log('📧 Email (console fallback):');
    console.log('To:', recipients.join(', '));
    console.log('From:', fromAddress);
    console.log('Subject:', subject);
    console.log('HTML:', html);
    if (text) console.log('Text:', text);
    
    return {
      success: true,
      messageId: `console-${Date.now()}`,
    };
  }
  
  // No email provider configured
  return {
    success: false,
    error: 'No email provider configured. Set RESEND_API_KEY or SMTP_* environment variables.',
  };
}

/**
 * Send email to multiple recipients
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  // Send to each recipient individually to avoid issues with bulk sending
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient,
      subject,
      html,
      text,
    });
    results.push(result);
  }
  
  return results;
}

/**
 * Strip HTML tags from HTML string to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Generate HTML email template for subscription expiration notification
 */
export function generateSubscriptionExpiredEmail(data: {
  organizationName: string;
  planName: string;
  expirationDate: string;
  status: 'expired' | 'canceled';
}): { subject: string; html: string; text: string } {
  const { organizationName, planName, expirationDate, status } = data;
  
  const statusText = status === 'canceled' ? 'annulé' : 'expiré';
  const statusColor = status === 'canceled' ? '#dc2626' : '#f59e0b';
  
  const subject = `[SambaOne] Votre abonnement a été ${statusText}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">SambaOne</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1f2937; margin-top: 0;">Abonnement ${statusText}</h2>
    
    <p>Bonjour,</p>
    
    <p>Nous vous informons que l'abonnement de votre organisation <strong>${organizationName}</strong> a été ${statusText}.</p>
    
    <div style="background: #f9fafb; border-left: 4px solid ${statusColor}; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0;"><strong>Détails de l'abonnement :</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li><strong>Plan :</strong> ${planName}</li>
        <li><strong>Date d'expiration :</strong> ${expirationDate}</li>
        <li><strong>Statut :</strong> ${statusText}</li>
      </ul>
    </div>
    
    <p>Votre accès à l'application a été suspendu. Pour réactiver votre abonnement :</p>
    
    <ol style="padding-left: 20px;">
      <li>Connectez-vous à votre compte administrateur</li>
      <li>Accédez à la page de gestion des abonnements</li>
      <li>Renouvelez ou activez un nouvel abonnement</li>
    </ol>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.sambaone.com'}/settings/subscription" 
         style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Gérer mon abonnement
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Si vous avez des questions, n'hésitez pas à nous contacter à 
      <a href="mailto:support@sambaone.com" style="color: #667eea;">support@sambaone.com</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
SambaOne - Abonnement ${statusText}

Bonjour,

Nous vous informons que l'abonnement de votre organisation ${organizationName} a été ${statusText}.

Détails de l'abonnement :
- Plan : ${planName}
- Date d'expiration : ${expirationDate}
- Statut : ${statusText}

Votre accès à l'application a été suspendu. Pour réactiver votre abonnement :
1. Connectez-vous à votre compte administrateur
2. Accédez à la page de gestion des abonnements
3. Renouvelez ou activez un nouvel abonnement

Lien : ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.sambaone.com'}/settings/subscription

Si vous avez des questions, contactez-nous à support@sambaone.com

---
Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
  `.trim();
  
  return { subject, html, text };
}




