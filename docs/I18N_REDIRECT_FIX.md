# I18N Redirect Fix Report

## Issue Description

The application was experiencing `NEXT_REDIRECT` errors in the `src/app/[locale]/(auth)/layout.tsx` file when using the `redirect()` function from `next/navigation`.

## Root Cause

When using next-intl with locale routing (`[locale]` directory structure), redirects in server components need to include the locale prefix in the redirect paths. The original implementation was using paths without locale prefixes (e.g., `/auth/sign-in`), which caused issues with the locale routing system.

## Solution

Updated the `AuthLayout` component to:

1. **Accept locale from params**: The layout now receives `params` as a Promise and extracts the `locale` value
2. **Validate locale**: Ensures the locale is valid before proceeding
3. **Include locale in redirect paths**: All redirect paths now include the locale prefix (e.g., `/${locale}/auth/sign-in`)

## Changes Made

### File: `src/app/[locale]/(auth)/layout.tsx`

1. Added `params` parameter to the component signature
2. Extracted locale from params: `const { locale } = await params;`
3. Added locale validation
4. Updated all redirect calls to include locale prefix:
   - `/auth/sign-in` → `/${locale}/auth/sign-in`
   - `/admin/select-organization` → `/${locale}/admin/select-organization`
   - `/admin` → `/${locale}/admin`
   - `/setup` → `/${locale}/setup`

## Technical Details

### Next.js Redirect Behavior

The `NEXT_REDIRECT` error is actually expected behavior in Next.js. The `redirect()` function throws a special error internally that Next.js catches to perform the redirect. This is not a bug, but part of Next.js's internal mechanism.

However, when using locale routing, the redirect paths must be locale-aware to ensure proper routing.

### Next-Intl Routing

With next-intl:
- Routes are structured as `/[locale]/path`
- Server components in `[locale]` directories should include the locale in redirect paths
- The middleware handles locale detection and routing, but redirects need explicit locale paths

## Testing Recommendations

1. Test redirects from the auth layout:
   - Unauthenticated user should redirect to sign-in with correct locale
   - Super admin without organization should redirect to admin/select-organization
   - Regular user without organization should redirect to setup
   - Dashboard access for super admin should redirect to admin page

2. Verify locale is preserved in redirects:
   - `/fr/dashboard` should redirect to `/fr/admin` (not `/en/admin`)
   - `/en/dashboard` should redirect to `/en/admin` (not `/fr/admin`)

3. Test with both locales (fr and en)

## Related Files

- `src/i18n/routing.ts` - Routing configuration
- `src/middleware.ts` - Middleware handling locale routing
- `src/app/[locale]/layout.tsx` - Locale layout wrapper

## Additional Notes

- The console error about "Invalid source map" is unrelated to this fix and is a known issue with Next.js source maps in development mode
- All redirect paths now properly include the locale prefix
- The locale validation ensures only valid locales (fr, en) are accepted

