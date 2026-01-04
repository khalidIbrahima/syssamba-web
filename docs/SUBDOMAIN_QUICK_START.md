# Subdomain Setup - Quick Start Guide

This is a condensed version of the full guide. For detailed instructions, see [SUBDOMAIN_SETUP_GUIDE.md](./SUBDOMAIN_SETUP_GUIDE.md).

## Overview

Each organization will get a unique subdomain like `org-name.kspace-group.com` when they sign up and complete setup.

## Quick Setup (5 Steps)

### 1. DNS Configuration (Vercel Recommended)

**In Vercel:**
1. Go to Project → Settings → Domains
2. Add `kspace-group.com`
3. Add `*.kspace-group.com` (wildcard)

**In Hostinger DNS:**
```
A Record: @ → 76.76.21.21 (Vercel IP - check dashboard)
CNAME: * → cname.vercel-dns.com
```

### 2. Database Migration

Run the migration file:
```bash
psql -d your_database -f init-db/76-add-subdomain-to-organizations.sql
```

Or manually:
```sql
ALTER TABLE organizations ADD COLUMN subdomain TEXT UNIQUE;
CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);
```

### 3. Environment Variables

Add to `.env.local` and Vercel:
```env
NEXT_PUBLIC_ROOT_DOMAIN=kspace-group.com
```

### 4. Code Updates

The following files need updates (see full guide for details):
- ✅ `src/middleware.ts` - Add subdomain routing
- ✅ `src/app/api/organization/setup/route.ts` - Generate subdomain
- ✅ `src/lib/subdomain-utils.ts` - Utility functions (already created)
- ✅ `src/db/schema.ts` - Add subdomain field
- ✅ `src/types/index.ts` - Add subdomain to Organization type

### 5. Test

1. Sign up a new user
2. Complete organization setup
3. Check database: `SELECT subdomain FROM organizations WHERE id = '...'`
4. Visit: `https://[subdomain].kspace-group.com`

## Key Files Created

- 📄 `docs/SUBDOMAIN_SETUP_GUIDE.md` - Complete detailed guide
- 📄 `docs/SUBDOMAIN_SETUP_CHECKLIST.md` - Step-by-step checklist
- 📄 `init-db/76-add-subdomain-to-organizations.sql` - Database migration
- 📄 `src/lib/subdomain-utils.ts` - Utility functions

## Common Issues

**Subdomain not resolving?**
- Wait for DNS propagation (up to 48 hours)
- Check DNS records are correct
- Use `dig *.kspace-group.com` to test

**SSL errors?**
- Vercel auto-provisions SSL (wait a few minutes)
- For manual setup, install wildcard SSL certificate

**Organization not found?**
- Verify subdomain exists in database
- Check middleware logs
- Verify subdomain format is valid

## Next Steps

1. Read the [full guide](./SUBDOMAIN_SETUP_GUIDE.md) for detailed instructions
2. Follow the [checklist](./SUBDOMAIN_SETUP_CHECKLIST.md) step by step
3. Test thoroughly before production deployment

---

**Need Help?** Refer to the troubleshooting section in the full guide.

