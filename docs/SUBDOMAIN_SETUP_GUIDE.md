# Subdomain Setup Guide for Organizations

This guide will help you set up subdomains for each organization when users sign up and complete organization setup. Each organization will get a unique subdomain like `org-name.syssamba.com`.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [DNS Configuration](#dns-configuration)
3. [Database Schema Updates](#database-schema-updates)
4. [Next.js Configuration](#nextjs-configuration)
5. [Middleware Updates](#middleware-updates)
6. [Code Changes](#code-changes)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Domain `syssamba.com` registered and accessible
- Access to DNS management (Hostinger or Vercel)
- Access to your database
- Next.js application deployed (Vercel recommended for easier subdomain handling)

---

## DNS Configuration

### Option 1: Using Vercel (Recommended)

Vercel automatically handles subdomain routing and SSL certificates for wildcard domains.

#### Step 1: Add Domain to Vercel

1. Go to your Vercel project settings
2. Navigate to **Domains**
3. Add `syssamba.com` as your primary domain
4. Add `*.syssamba.com` as a wildcard domain

#### Step 2: Configure DNS Records

In your Hostinger DNS settings, add these records:

```
Type: A
Name: @
Value: 76.76.21.21 (Vercel's IP - check Vercel dashboard for current IP)

Type: CNAME
Name: *
Value: cname.vercel-dns.com
```

**Note:** Vercel will provide you with the exact DNS records to add. Check your Vercel dashboard for the most current values.

#### Step 3: Verify Domain

1. Vercel will automatically verify your domain
2. Wait for DNS propagation (can take up to 48 hours, usually much faster)
3. Vercel will automatically provision SSL certificates for all subdomains

### Option 2: Using Hostinger Only

If you prefer to keep everything on Hostinger:

#### Step 1: Configure Wildcard DNS

In Hostinger DNS settings:

```
Type: A
Name: *
Value: [Your server IP address]

OR

Type: CNAME
Name: *
Value: [Your server hostname]
```

#### Step 2: Point to Your Server

- If using Vercel: Point to Vercel's IP
- If using your own server: Point to your server's IP

---

## Database Schema Updates

### Step 1: Add Subdomain Column

Add a `subdomain` column to the `organizations` table:

```sql
-- Migration: Add subdomain column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);

-- Update existing organizations to use slug as subdomain (if needed)
UPDATE organizations 
SET subdomain = slug 
WHERE subdomain IS NULL;
```

### Step 2: Update Database Schema File

Update `src/db/schema.ts`:

```typescript
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  subdomain: text('subdomain').unique(), // Add this line
  type: text('type').$type<'agency' | 'sci' | 'syndic' | 'individual'>().notNull(),
  // ... rest of your fields
});
```

---

## Next.js Configuration

### Step 1: Update `next.config.ts`

Add subdomain handling configuration:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ... existing config
  
  // Enable subdomain routing
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Subdomain',
            value: ':subdomain',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Step 2: Environment Variables

Add to your `.env.local` and Vercel environment variables:

```env
# Subdomain configuration
NEXT_PUBLIC_MAIN_DOMAIN=syssamba.com
```

---

## Middleware Updates

### Update `src/middleware.ts`

Replace the existing middleware with subdomain-aware routing:

```typescript
/**
 * Next.js Middleware
 * Handles subdomain routing, internationalization, route protection and authentication
 */

import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { routing } from '@/i18n/routing';
import { db } from '@/lib/db';

const intlMiddleware = createMiddleware(routing);

const publicRoutes = ['/auth', '/invite', '/', '/pricing'];
const protectedRoutes = [
  '/dashboard',
  '/properties',
  '/units',
  '/tenants',
  '/leases',
  '/payments',
  '/accounting',
  '/tasks',
  '/notifications',
  '/settings',
  '/setup',
  '/admin',
];

// Extract subdomain from hostname
function getSubdomain(hostname: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
  
  // Remove protocol if present
  const cleanHostname = hostname.replace(/^https?:\/\//, '');
  
  // Remove port if present
  const hostWithoutPort = cleanHostname.split(':')[0];
  
  // Check if it's a subdomain
  if (hostWithoutPort.endsWith(`.${rootDomain}`)) {
    const subdomain = hostWithoutPort.replace(`.${rootDomain}`, '');
    // Don't treat 'www' as a subdomain
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }
  
  return null;
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const hostname = req.headers.get('host') || url.hostname;
  const subdomain = getSubdomain(hostname);
  const pathname = url.pathname;

  // If subdomain exists, look up organization
  if (subdomain) {
    try {
      // Look up organization by subdomain
      const organization = await db.selectOne<{ id: string; slug: string }>('organizations', {
        eq: { subdomain },
      });

      if (!organization) {
        // Organization not found, redirect to main domain
        const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
        const redirectUrl = new URL(`https://${mainDomain}${pathname}`, req.url);
        redirectUrl.search = url.search;
        return NextResponse.redirect(redirectUrl);
      }

      // Add organization context to request headers
      const response = intlMiddleware(req);
      const finalResponse = response || NextResponse.next();
      finalResponse.headers.set('x-organization-id', organization.id);
      finalResponse.headers.set('x-organization-slug', organization.slug);
      finalResponse.headers.set('x-subdomain', subdomain);
      
      // Continue with normal routing
      return handleNormalRouting(req, finalResponse, pathname);
    } catch (error) {
      console.error('[Middleware] Error looking up organization:', error);
      // Continue with normal routing if lookup fails
    }
  }

  // No subdomain or lookup failed, continue with normal routing
  const response = intlMiddleware(req);
  return handleNormalRouting(req, response, pathname);
}

async function handleNormalRouting(
  req: NextRequest,
  response: NextResponse,
  pathname: string
): Promise<NextResponse> {
  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';
  const pathnameWithoutLocale = localeMatch 
    ? pathname.replace(`/${locale}`, '') || '/' 
    : pathname;

  // If intl middleware redirected (e.g., to add locale), return it
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // Handle authentication for protected routes
  // Allow public routes
  if (publicRoutes.some(route => pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route + '/'))) {
    const finalResponse = response || NextResponse.next();
    finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
    return finalResponse;
  }

  // Check protected routes
  if (protectedRoutes.some(route => pathnameWithoutLocale.startsWith(route))) {
    try {
      // Skip authentication during build time
      if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const finalResponse = response || NextResponse.next();
        finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
        return finalResponse;
      }

      const supabase = createMiddlewareClient(req);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log(`[Middleware] Redirecting unauthenticated user from ${pathnameWithoutLocale} to sign-in`);
        const signInUrl = new URL(`/${locale}/auth/sign-in`, req.url);
        signInUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(signInUrl);
      }
    } catch (error) {
      console.log(`[Middleware] Auth error for ${pathnameWithoutLocale}:`, error);
      const signInUrl = new URL(`/${locale}/auth/sign-in`, req.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  const finalResponse = response || NextResponse.next();
  finalResponse.headers.set('x-pathname', pathnameWithoutLocale);
  return finalResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
```

---

## Code Changes

### Step 1: Update Organization Setup API

Update `src/app/api/organization/setup/route.ts`:

```typescript
// ... existing imports ...

export async function POST(request: NextRequest) {
  try {
    // ... existing validation code ...

    // Generate a unique slug for the organization
    const baseSlug = validatedData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let subdomain = baseSlug; // Use same slug for subdomain initially
    let counter = 1;

    // Ensure both slug and subdomain uniqueness
    while (true) {
      const existing = await db.selectOne<{ id: string }>('organizations', {
        or: [
          { eq: { slug } },
          { eq: { subdomain } },
        ],
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      subdomain = `${baseSlug}-${counter}`;
      counter++;
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: 'Invalid organization name for subdomain' },
        { status: 400 }
      );
    }

    // Create the organization
    const organization = await db.insertOne<{
      id: string;
      name: string;
      slug: string;
      subdomain: string;
      type: string;
      country: string;
      is_configured: boolean;
      created_at: string;
      updated_at: string;
    }>('organizations', {
      id: crypto.randomUUID(),
      name: validatedData.organizationName,
      slug,
      subdomain, // Add subdomain
      type: validatedData.organizationType,
      country: validatedData.country,
      is_configured: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // ... rest of existing code ...

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subdomain: organization.subdomain, // Include subdomain in response
        type: organization.type,
        country: organization.country,
      },
      message: 'Organisation configurée avec succès',
      subdomainUrl: `https://${organization.subdomain}.${process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com'}`,
    });

  } catch (error) {
    // ... existing error handling ...
  }
}
```

### Step 2: Create Helper Function for Organization Context

Create `src/lib/organization-context.ts`:

```typescript
import { headers } from 'next/headers';
import { db } from '@/lib/db';

export async function getOrganizationFromSubdomain() {
  const headersList = headers();
  const subdomain = headersList.get('x-subdomain');
  const organizationId = headersList.get('x-organization-id');

  if (organizationId) {
    // Organization already resolved by middleware
    return { id: organizationId, subdomain };
  }

  if (subdomain) {
    // Look up organization
    const organization = await db.selectOne<{ id: string; slug: string }>('organizations', {
      eq: { subdomain },
    });

    if (organization) {
      return { id: organization.id, subdomain };
    }
  }

  return null;
}

export function getSubdomainFromRequest(): string | null {
  if (typeof window !== 'undefined') {
    // Client-side
    const hostname = window.location.hostname;
    const rootDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'syssamba.com';
    
    if (hostname.endsWith(`.${rootDomain}`)) {
      const subdomain = hostname.replace(`.${rootDomain}`, '');
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }
  }
  
  return null;
}
```

### Step 3: Update Auth Helpers

Update `src/lib/auth-helpers.ts` to use subdomain context:

```typescript
// ... existing code ...

export async function getCurrentOrganization() {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }

  // Try to get organization from subdomain context first
  const orgContext = await getOrganizationFromSubdomain();
  if (orgContext && orgContext.id === user.organizationId) {
    // Verify it's the correct organization
    const organization = await db.selectOne<Organization>('organizations', {
      eq: { id: user.organizationId },
    });
    return organization;
  }

  // Fallback to user's organization
  const organization = await db.selectOne<Organization>('organizations', {
    eq: { id: user.organizationId },
  });

  return organization;
}
```

### Step 4: Update Types

Update `src/types/index.ts`:

```typescript
export type Organization = {
  id: string;
  name: string;
  slug: string;
  subdomain?: string; // Add subdomain
  type: 'agency' | 'sci' | 'syndic' | 'individual';
  country: string;
  extranetTenantsCount: number;
  customExtranetDomain?: string;
  stripeCustomerId?: string;
  isConfigured?: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

---

## SSL Certificate Setup

### Option 1: Vercel (Automatic)

Vercel automatically provisions SSL certificates for all subdomains when you:
1. Add the wildcard domain `*.syssamba.com`
2. Verify the domain
3. Vercel handles everything automatically

### Option 2: Manual SSL (If not using Vercel)

If using your own server, you'll need a wildcard SSL certificate:

1. **Purchase Wildcard SSL Certificate**
   - From providers like Let's Encrypt (free), Cloudflare, or others
   - Must support `*.syssamba.com`

2. **Install Certificate**
   - Follow your server provider's instructions
   - For Let's Encrypt: Use certbot with DNS challenge

3. **Auto-renewal**
   - Set up automatic renewal for the certificate

---

## Testing

### Step 1: Test DNS Propagation

```bash
# Test if wildcard DNS is working
dig *.syssamba.com

# Test specific subdomain
dig test.syssamba.com
```

### Step 2: Test Subdomain Creation

1. Sign up a new user
2. Complete organization setup
3. Check database for subdomain:
   ```sql
   SELECT id, name, slug, subdomain FROM organizations ORDER BY created_at DESC LIMIT 1;
   ```

### Step 3: Test Subdomain Access

1. Visit `https://[subdomain].syssamba.com`
2. Verify it loads your application
3. Check browser console for any errors
4. Verify organization context is correct

### Step 4: Test Middleware

1. Access a protected route via subdomain
2. Verify authentication works
3. Verify organization context is passed correctly

---

## Troubleshooting

### Issue: Subdomain not resolving

**Solution:**
- Check DNS propagation (can take up to 48 hours)
- Verify DNS records are correct
- Use `dig` or `nslookup` to test DNS

### Issue: SSL certificate errors

**Solution:**
- If using Vercel: Wait for automatic SSL provisioning (can take a few minutes)
- If using manual SSL: Verify certificate is installed correctly
- Check certificate expiration date

### Issue: Organization not found

**Solution:**
- Verify subdomain exists in database
- Check middleware logs for errors
- Verify subdomain format is correct (lowercase, alphanumeric, hyphens only)

### Issue: Wrong organization loaded

**Solution:**
- Verify middleware is correctly extracting subdomain
- Check organization lookup query
- Verify headers are being passed correctly

### Issue: Redirect loops

**Solution:**
- Check middleware logic for infinite redirects
- Verify public routes are accessible
- Check authentication flow

---

## Additional Considerations

### 1. Subdomain Validation

Add validation to ensure subdomains are:
- Lowercase only
- Alphanumeric and hyphens only
- Not reserved words (www, api, admin, etc.)
- Minimum 3 characters, maximum 63 characters

### 2. Reserved Subdomains

Create a list of reserved subdomains that cannot be used:

```typescript
const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'ftp',
  'localhost',
  'staging',
  'dev',
  'test',
  'demo',
];
```

### 3. Subdomain Change

Allow organizations to change their subdomain (with validation):

```typescript
// API endpoint to update subdomain
export async function PATCH(request: NextRequest) {
  // Validate new subdomain
  // Check availability
  // Update database
  // Return new URL
}
```

### 4. Analytics

Track subdomain usage:
- Which organizations use subdomains
- Subdomain access patterns
- Performance metrics per subdomain

---

## Next Steps

1. ✅ Set up DNS records
2. ✅ Update database schema
3. ✅ Update middleware
4. ✅ Update organization setup API
5. ✅ Test subdomain creation
6. ✅ Test subdomain access
7. ✅ Monitor for errors
8. ✅ Add analytics tracking

---

## Support

If you encounter issues:
1. Check Vercel/Hostinger logs
2. Check application logs
3. Verify DNS propagation
4. Test with `curl` or `dig`
5. Review middleware logs

---

**Last Updated:** 2024
**Version:** 1.0

