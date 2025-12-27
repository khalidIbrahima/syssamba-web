import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'CLERK_WEBHOOK_SECRET is not set' },
      { status: 500 }
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Error occurred -- no svix headers' },
      { status: 400 }
    );
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(webhookSecret);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json(
      { error: 'Error occurred -- verification failed' },
      { status: 400 }
    );
  }

  // Handle the webhook
  const eventType = evt.type;

  try {
    if (eventType === 'user.created') {
      const data = evt.data;
      const id = data.id as string;
      
      // Get primary email and phone
      const emailAddresses = data.email_addresses as Array<{ id: string; email_address: string }> || [];
      const phoneNumbers = data.phone_numbers as Array<{ id: string; phone_number: string }> || [];
      const primaryEmailId = data.primary_email_address_id as string;
      const primaryPhoneId = data.primary_phone_number_id as string | null;

      const primaryEmail = emailAddresses.find((email) => email.id === primaryEmailId)?.email_address;
      const primaryPhone = primaryPhoneId 
        ? phoneNumbers.find((phone) => phone.id === primaryPhoneId)?.phone_number 
        : null;

      // Create user in database
      await db.insert(users).values({
        clerkId: id,
        email: primaryEmail || null,
        phone: primaryPhone || null,
        firstName: (data.first_name as string) || null,
        lastName: (data.last_name as string) || null,
        avatarUrl: (data.image_url as string) || null,
        role: 'viewer', // Default role
        isActive: true,
      });

      console.log(`User created in database: ${id}`);
    }

    if (eventType === 'user.updated') {
      const data = evt.data;
      const id = data.id as string;
      
      // Get primary email and phone
      const emailAddresses = data.email_addresses as Array<{ id: string; email_address: string }> || [];
      const phoneNumbers = data.phone_numbers as Array<{ id: string; phone_number: string }> || [];
      const primaryEmailId = data.primary_email_address_id as string;
      const primaryPhoneId = data.primary_phone_number_id as string | null;

      const primaryEmail = emailAddresses.find((email) => email.id === primaryEmailId)?.email_address;
      const primaryPhone = primaryPhoneId 
        ? phoneNumbers.find((phone) => phone.id === primaryPhoneId)?.phone_number 
        : null;

      // Update user in database
      await db
        .update(users)
        .set({
          email: primaryEmail || null,
          phone: primaryPhone || null,
          firstName: (data.first_name as string) || null,
          lastName: (data.last_name as string) || null,
          avatarUrl: (data.image_url as string) || null,
        })
        .where(eq(users.clerkId, id));

      console.log(`User updated in database: ${id}`);
    }

    if (eventType === 'user.deleted') {
      const data = evt.data;
      const id = data.id as string;

      // Hard delete: completely remove user from database
      await db
        .delete(users)
        .where(eq(users.clerkId, id));

      console.log(`User deleted from database: ${id}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

