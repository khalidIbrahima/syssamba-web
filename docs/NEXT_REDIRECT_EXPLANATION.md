# NEXT_REDIRECT Error Explanation

## What is NEXT_REDIRECT?

The `NEXT_REDIRECT` error you see in the console/stack trace is **NOT a bug** - it's the expected internal mechanism that Next.js uses to implement server-side redirects.

## How Next.js Redirects Work

In Next.js (especially Next.js 13+ with App Router), the `redirect()` function works by:

1. Throwing a special error internally (`NEXT_REDIRECT`)
2. Next.js's routing system catches this error
3. The router uses the error to perform the redirect
4. The redirect happens transparently to the user

This is an intentional design choice by Next.js to handle redirects in server components.

## Why You're Seeing This Error

You see `NEXT_REDIRECT` in:
- Development mode console/error logs
- Stack traces during development
- Error boundaries (though it should be caught)

This is **normal behavior** and does not indicate a problem with your code.

## Current Implementation

Our current implementation in `src/app/[locale]/(auth)/layout.tsx` is correct:

```typescript
import { redirect } from 'next/navigation';

// In the component:
redirect(`/${locale}/admin/select-organization`);
```

This is the correct approach for server components with locale routing.

## Is This a Problem?

**No, this is not a problem.** The redirects are working correctly. The error message is just Next.js's internal mechanism being visible in development mode.

## How to Verify Redirects Are Working

1. **Test the redirects manually**: Navigate to the pages that trigger redirects and verify they work correctly
2. **Check the URL**: After redirect, the URL should change to the target location
3. **Check browser network tab**: You should see a redirect response (307 or 308 status code)

## Should We Change Anything?

**No changes are needed** to the code. The implementation is correct.

However, if the error messages are cluttering your development console, you can:

1. **Filter console errors**: Use browser dev tools to filter out NEXT_REDIRECT errors
2. **Use error boundaries**: Ensure error boundaries properly catch and handle NEXT_REDIRECT (they should by default)
3. **Check Next.js version**: Ensure you're using a compatible version (Next.js 13+)

## Additional Notes

- The error only appears in **development mode**
- In **production builds**, these errors are handled silently
- The redirects function correctly despite the error message
- This is documented Next.js behavior, not a bug

## References

- [Next.js Redirect Documentation](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming#error-handling)

## Conclusion

The `NEXT_REDIRECT` error is expected behavior and indicates that redirects are working correctly. No code changes are needed. This is simply Next.js's internal redirect mechanism being visible in development mode.

