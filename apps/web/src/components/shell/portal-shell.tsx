'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  FilePlus2,
  Wallet,
  FolderOpen,
  UserRound,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { clearStoredAuth, type AuthSession } from '@/lib/auth';
import { NotificationsBell } from '@/components/notifications/notifications-bell';

const nav = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/apply', label: 'Apply', icon: FilePlus2 },
  { href: '/portal/loans', label: 'My loans', icon: Wallet },
  { href: '/portal/documents', label: 'Documents', icon: FolderOpen },
  { href: '/portal/profile', label: 'Profile', icon: UserRound },
];

const titles: Record<string, { title: string; subtitle: string }> = {
  '/portal': {
    title: 'Welcome',
    subtitle: 'Your loans and next steps',
  },
  '/portal/apply': {
    title: 'Apply for a loan',
    subtitle: 'Choose a product and submit your application',
  },
  '/portal/loans': {
    title: 'My loans',
    subtitle: 'Applications and active balances',
  },
  '/portal/documents': {
    title: 'Documents',
    subtitle: 'Upload and track KYC documents',
  },
  '/portal/profile': {
    title: 'Profile',
    subtitle: 'Your contact details',
  },
};

export function PortalShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AuthSession;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const meta =
    titles[pathname] ??
    (pathname.startsWith('/portal/loans/')
      ? { title: 'Loan detail', subtitle: 'Status and repayment schedule' }
      : { title: 'Borrower portal', subtitle: 'LendSync' });

  const initials = (session.fullName || session.email || 'B')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function NavItem({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }) {
    const active =
      href === '/portal' ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-foreground',
          collapsed && 'justify-center px-2',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Logo className="h-6 w-6 rounded-[4px] object-cover" />
          {!collapsed && (
            <div>
              <div className="font-display text-sm font-semibold tracking-tight">
                LendSync
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Borrower Portal
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <div>
            {!collapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Main
              </div>
            )}
            <div className="space-y-1">
              {nav.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2',
              collapsed && 'justify-center',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">
                  {session.fullName || 'Borrower'}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {session.email}
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {meta.title}
            </h1>
            <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationsBell />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearStoredAuth();
                router.push('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
