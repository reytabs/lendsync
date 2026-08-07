'use client';

import { PortalShell } from '@/components/shell/portal-shell';
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
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading portal…
      </div>
    );
  }

  return <PortalShell session={session}>{children}</PortalShell>;
}
