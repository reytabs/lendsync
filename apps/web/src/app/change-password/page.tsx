'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getStoredAuth();
    if (!session) {
      router.replace('/login');
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    const session = getStoredAuth();
    if (!session) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message || 'Password change failed',
        );
      }
      setStoredAuth(data);
      const next = getStoredAuth();
      if (next) identifyAuthSession(next);
      router.replace(homeForRole(data.user?.role ?? session.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
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
            Change password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set a new password before continuing.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Current password</span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">New password</span>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Confirm new password</span>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
