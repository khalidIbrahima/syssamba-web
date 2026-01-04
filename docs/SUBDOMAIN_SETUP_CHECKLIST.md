# Subdomain Setup Checklist

Quick reference checklist for setting up subdomains for organizations.

## Pre-Setup

- [ ] Domain `kspace-group.com` is registered and active
- [ ] Access to DNS management (Hostinger or Vercel)
- [ ] Database access for schema updates
- [ ] Next.js application deployed

## DNS Configuration

### If Using Vercel (Recommended)
- [ ] Add `kspace-group.com` as primary domain in Vercel
- [ ] Add `*.kspace-group.com` as wildcard domain in Vercel
- [ ] Update DNS records in Hostinger:
  - [ ] Add A record: `@` → Vercel IP
  - [ ] Add CNAME record: `*` → `cname.vercel-dns.com`
- [ ] Wait for DNS propagation (check with `dig *.kspace-group.com`)
- [ ] Verify domain in Vercel dashboard
- [ ] Confirm SSL certificates are auto-provisioned

### If Using Hostinger Only
- [ ] Add wildcard A record: `*` → Your server IP
- [ ] Or add wildcard CNAME: `*` → Your server hostname
- [ ] Set up wildcard SSL certificate
- [ ] Configure SSL auto-renewal

## Database Setup

- [ ] Run migration: `init-db/76-add-subdomain-to-organizations.sql`
- [ ] Verify `subdomain` column exists in `organizations` table
- [ ] Verify index `idx_organizations_subdomain` is created
- [ ] Update existing organizations with subdomains (if needed)
- [ ] Test subdomain uniqueness constraint

## Code Updates

- [ ] Update `src/db/schema.ts` to include `subdomain` field
- [ ] Update `src/middleware.ts` with subdomain routing logic
- [ ] Update `src/app/api/organization/setup/route.ts` to generate subdomains
- [ ] Create `src/lib/subdomain-utils.ts` utility file
- [ ] Update `src/types/index.ts` to include `subdomain` in Organization type
- [ ] Update `src/lib/auth-helpers.ts` to use subdomain context
- [ ] Add environment variables:
  - [ ] `NEXT_PUBLIC_ROOT_DOMAIN=kspace-group.com`
  - [ ] `NEXT_PUBLIC_WILDCARD_DOMAIN=*.kspace-group.com`

## Testing

- [ ] Test DNS resolution: `dig test.kspace-group.com`
- [ ] Create a test organization via sign-up flow
- [ ] Verify subdomain is created in database
- [ ] Access organization via subdomain URL
- [ ] Test authentication on subdomain
- [ ] Test protected routes on subdomain
- [ ] Test organization context is correct
- [ ] Test subdomain uniqueness (try creating duplicate)
- [ ] Test reserved subdomain validation
- [ ] Test invalid subdomain format rejection

## Production Deployment

- [ ] Deploy code changes to production
- [ ] Run database migration in production
- [ ] Verify DNS records are correct
- [ ] Test first organization subdomain creation
- [ ] Monitor error logs for subdomain-related issues
- [ ] Set up monitoring/alerts for subdomain failures
- [ ] Document subdomain management process

## Post-Deployment

- [ ] Monitor subdomain creation success rate
- [ ] Check SSL certificate provisioning
- [ ] Verify organization context is working correctly
- [ ] Test subdomain access from different locations
- [ ] Document any issues encountered
- [ ] Create runbook for subdomain troubleshooting

## Rollback Plan (If Needed)

- [ ] Document rollback steps
- [ ] Keep backup of database before migration
- [ ] Test rollback procedure in staging
- [ ] Have DNS rollback plan ready

---

**Notes:**
- DNS propagation can take up to 48 hours (usually much faster)
- SSL certificate provisioning on Vercel is automatic but may take a few minutes
- Test thoroughly in staging before production deployment

