'use client';

import { PortalShell } from '@/components/shell/portal-shell';
import { AppShellSkeleton } from '@/components/skeletons';
import { CurrencyProvider } from '@/lib/currency';
import { useAuthGate } from '@/lib/auth';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, session } = useAuthGate({
    allow: ['borrower'],
    redirectIfWrong: '/dashboard',
  });

  if (!ready || !session) {
    return <AppShellSkeleton />;
  }

  return (
    <CurrencyProvider>
      <PortalShell session={session}>{children}</PortalShell>
    </CurrencyProvider>
  );
}
