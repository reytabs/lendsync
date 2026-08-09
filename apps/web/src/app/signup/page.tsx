'use client';

import { useState } from 'react';
import Link from 'next/link';
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

export default function SignupPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'PHP'>('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl()}/api/orgs/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          fullName,
          email,
          password,
          currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message || 'Could not create workspace',
        );
      }

      setStoredAuth(data);
      const session = getStoredAuth();
      if (session) identifyAuthSession(session);
      posthog.capture('org_signed_up', { currency });
      router.push(homeForRole(data.user?.role ?? 'admin'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
            Start your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your organization and start a 14-day free trial.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Organization name</span>
            <Input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Lending Co."
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Your name</span>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Dela Cruz"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Work email</span>
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
              placeholder="At least 8 characters"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Currency</span>
            <select
              className="field-control w-full"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'PHP')}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="PHP">PHP — Philippine Peso</option>
            </select>
          </label>
          {error && <p className="text-sm text-chart-red">{error}</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? 'Creating workspace…' : 'Create workspace'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
