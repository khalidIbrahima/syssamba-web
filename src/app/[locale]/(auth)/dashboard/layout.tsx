/**
 * Layout for dashboard
 * Note: Authentication and organization checks are handled by the parent (auth)/layout.tsx
 * This layout only serves as a wrapper - no additional checks needed
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // All authentication and organization checks are handled by parent (auth)/layout.tsx
  // No need to duplicate checks here - just render children
  return <>{children}</>;
}
