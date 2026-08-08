'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { CurrencyProvider } from '@/lib/currency';
import { useAuthGate } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useAuthGate({
    allow: ['admin', 'loan_officer'],
    redirectIfWrong: '/dashboard',
  });

  useEffect(() => {
    // borrower's redirect handled inside useAuthGate
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <CurrencyProvider>
      <AppShell>{children}</AppShell>
    </CurrencyProvider>
  );
}
