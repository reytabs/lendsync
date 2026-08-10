'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calculator,
  BarChart3,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeft,
  Banknote,
  Compass,
  PhoneCall,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getStoredAuth, logoutAuthSession } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { OrgSwitcher } from '@/components/shell/org-switcher';
import { startStaffTour } from '@/components/tour/staff-tour';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  officer: 'Loan Officer',
  loan_officer: 'Loan Officer',
  viewer: 'Viewer',
  collector: 'Collector',
  borrower: 'Borrower',
};

function canAccessAdmin(role: string) {
  return role === 'admin' || role === 'owner';
}

const mainNavAll = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tour: 'nav-dashboard',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer', 'collector'],
  },
  {
    href: '/applications',
    label: 'Loan Applications',
    icon: FileText,
    tour: 'nav-applications',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer'],
  },
  {
    href: '/borrowers',
    label: 'Borrowers',
    icon: Users,
    tour: 'nav-borrowers',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer'],
  },
  {
    href: '/collections',
    label: 'Collections',
    icon: PhoneCall,
    tour: 'nav-collections',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer', 'collector'],
  },
  {
    href: '/repayments',
    label: 'Repayments',
    icon: Banknote,
    tour: 'nav-repayments',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer', 'collector'],
  },
  {
    href: '/emi-calculator',
    label: 'EMI Calculator',
    icon: Calculator,
    tour: 'nav-emi',
    roles: ['admin', 'owner', 'loan_officer', 'officer', 'viewer', 'collector'],
  },
];

const titles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Financial Overview',
    subtitle: 'Portfolio performance and key metrics',
  },
  '/applications': {
    title: 'Loan Applications',
    subtitle: 'Review and manage loan requests',
  },
  '/borrowers': {
    title: 'Borrower Profiles',
    subtitle: 'Customer accounts and credit history',
  },
  '/collections': {
    title: 'Collections',
    subtitle: 'Overdue queue, outreach notes, and promises to pay',
  },
  '/repayments': {
    title: 'Repayments',
    subtitle: 'Disburse loans and record borrower payments',
  },
  '/emi-calculator': {
    title: 'EMI Calculator',
    subtitle: 'Compute repayment schedules and amortization',
  },
  '/reports': {
    title: 'Reports & Analytics',
    subtitle: 'Data insights and performance trends',
  },
  '/admin': {
    title: 'Admin Panel',
    subtitle: 'System configuration and access control',
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    role: string;
    email: string;
  }>({
    name: 'Loading…',
    role: '',
    email: '',
  });
  const tourStarted = useRef(false);
  const meta = titles[pathname] ?? {
    title: 'LendSync',
    subtitle: 'Lending Management System',
  };

  const mainNav = useMemo(() => {
    const role = user.role || 'loan_officer';
    return mainNavAll.filter((item) => item.roles.includes(role));
  }, [user.role]);

  const analyticsNav = useMemo(() => {
    const items = [
      {
        href: '/reports',
        label: 'Reports & Analytics',
        icon: BarChart3,
        tour: 'nav-reports',
      },
    ];
    if (canAccessAdmin(user.role)) {
      items.push({
        href: '/admin',
        label: 'Admin Panel',
        icon: Settings,
        tour: 'nav-admin',
      });
    }
    return items;
  }, [user.role]);

  useEffect(() => {
    const session = getStoredAuth();
    if (session) {
      setUser({
        name: session.fullName || session.email || 'User',
        role: session.orgRole || session.role || '',
        email: session.email || '',
      });
    }
  }, []);

  useEffect(() => {
    if (!user.email || !user.role || tourStarted.current) return;
    if (user.role === 'borrower') return;
    tourStarted.current = true;
    startStaffTour({
      email: user.email,
      role: user.role,
      ensureExpanded: () => setCollapsed(false),
    });
  }, [user.email, user.role]);

  function replayTour() {
    if (!user.email) return;
    startStaffTour({
      email: user.email,
      role: user.role,
      force: true,
      ensureExpanded: () => setCollapsed(false),
    });
  }

  function NavItem({
    href,
    label,
    icon: Icon,
    tour,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tour?: string;
  }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        data-tour={tour}
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
        <div
          data-tour="brand"
          className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4"
        >
          <Logo className="h-10 w-10 rounded-[6px] object-cover" />
          {!collapsed && (
            <div>
              <div className="font-display text-sm font-semibold tracking-tight">
                LendSync
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                LENDING PLATFORM
              </div>
            </div>
          )}
        </div>

        <div data-tour="org-switcher" className="border-b border-sidebar-border p-3">
          <OrgSwitcher collapsed={collapsed} />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <div>
            {!collapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Main
              </div>
            )}
            <div className="space-y-1">
              {mainNav.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
          <div>
            {!collapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Analytics
              </div>
            )}
            <div className="space-y-1">
              {analyticsNav.map((item) => (
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
              {initialsOf(user.name)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">
                  {user.name}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {roleLabels[user.role] ?? user.role}
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
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-muted-foreground"
            onClick={replayTour}
            title="Take a tour"
          >
            <Compass className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Take a tour</span>}
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
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-56 pl-9" placeholder="Quick search…" />
            </div>
            <ThemeToggle />
            <div data-tour="notifications">
              <NotificationsBell />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                logoutAuthSession();
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
