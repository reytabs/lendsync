'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Bolt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { DualPreview } from '@/components/landing/dual-preview';
import { getStoredAuth, homeForRole } from '@/lib/auth';
import { cn } from '@/lib/utils';

const pillars = [
  {
    icon: Users,
    title: 'Built for every role',
    body: 'Powerful tools for lenders. A simple experience for borrowers.',
  },
  {
    icon: Bolt,
    title: 'Faster decisions',
    body: 'Move applications from review to funding without losing the trail.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    body: 'Org-scoped data, role-based access, and an audit log you can trust.',
  },
  {
    icon: BarChart3,
    title: 'Actionable insights',
    body: 'Portfolio health, collections, and exports when leadership asks.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth && !auth.mustChangePassword) {
      router.replace(homeForRole(auth.role));
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b0e] text-sm text-white/40">
        Loading…
      </div>
    );
  }

  return (
    <div className="landing-dual min-h-screen bg-[#0a0b0e] text-white">
      <header className="relative z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-9 w-9 rounded-[6px] object-cover" />
          <span className="font-display text-sm font-semibold tracking-tight">
            LendSync
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-white/80',
            )}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'hidden sm:inline-flex',
            )}
          >
            Start free trial
          </Link>
        </div>
      </header>

      {/* Hero: dual product plane + centered brand overlay */}
      <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
        <div className="landing-glow pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(212,165,60,0.1),transparent_55%)]" />

        <div
          className={cn(
            'absolute inset-0 z-0 scale-[1.02] opacity-40 sm:opacity-50',
            'animate-in fade-in-0 duration-1000',
          )}
        >
          <div className="h-full min-h-full [&_>div]:min-h-full">
            <DualPreview />
          </div>
        </div>

        {/* Readable veil over the product plane — not a card */}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-[#0a0b0e]/70 via-[#0a0b0e]/50 to-[#0a0b0e]/85" />

        <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div
              className={cn(
                'mx-auto mb-5 flex h-14 w-14 items-center justify-center sm:mb-6 sm:h-16 sm:w-16',
                'animate-in fade-in-0 zoom-in-95 duration-700',
              )}
            >
              <Logo className="h-full w-full rounded-[10px] object-cover" />
            </div>

            <p
              className={cn(
                'font-display text-sm font-semibold tracking-[0.18em] text-chart-gold uppercase',
                'animate-in fade-in-0 slide-in-from-bottom-2 duration-700 fill-mode-both',
              )}
            >
              LendSync
            </p>

            <h1
              className={cn(
                'mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl md:text-6xl',
                'animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both',
              )}
              style={{ animationDelay: '80ms' }}
            >
              Lending operations, clearly managed.
            </h1>

            <p
              className={cn(
                'mx-auto mt-4 max-w-md text-sm text-white/55 sm:text-base',
                'animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both',
              )}
              style={{ animationDelay: '160ms' }}
            >
              Streamline every step of the lending journey — from application to
              repayment.
            </p>

            <div
              className={cn(
                'mt-8 flex flex-wrap items-center justify-center gap-3',
                'animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both',
              )}
              style={{ animationDelay: '240ms' }}
            >
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                Start free trial
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'border-chart-gold/50 bg-transparent text-white hover:bg-chart-gold/10',
                )}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {pillars.map((p) => (
            <div key={p.title}>
              <p.icon className="mb-3 h-5 w-5 text-chart-gold" aria-hidden />
              <h2 className="font-display text-base font-semibold tracking-tight">
                {p.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-16 text-center sm:px-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Create your workspace
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
          Staff console and borrower portal in one multi-tenant lending system.
        </p>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: 'lg' }), 'mt-6 inline-flex')}
        >
          Start 14-day free trial
        </Link>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-5 py-6 text-xs text-white/40 sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} LendSync</span>
        <div className="flex gap-4">
          <Link href="/login" className="hover:text-white/70">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-white/70">
            Create workspace
          </Link>
        </div>
      </footer>
    </div>
  );
}
