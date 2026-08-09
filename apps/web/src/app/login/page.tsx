'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  getStoredAuth,
  homeForRole,
  identifyAuthSession,
  setStoredAuth,
} from '@/lib/auth';
import { apiBaseUrl } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@lendsync.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message || 'Invalid credentials',
        );
      }

      setStoredAuth(data);
      const session = getStoredAuth();
      if (session) {
        identifyAuthSession(session);
      }
      posthog.capture('user_logged_in', {
        role: data.user?.role ?? 'borrower',
      });
      router.push(homeForRole(data.user?.role ?? 'borrower'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-4 h-16 w-16 rounded-[8px] object-cover" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            LendSync
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lending operations, clearly managed.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-chart-red">{error}</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Staff: admin@lendsync.local / admin123
            <br />
            Borrower: maria@example.com / borrower123
          </p>
        </form>
      </div>
    </div>
  );
}
