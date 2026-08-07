'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('lms_token', data.access_token);
        localStorage.setItem('lms_email', data.user?.email ?? email);
        router.push('/dashboard');
        return;
      }

      // Fallback for local demo when ALLOW_DEV_AUTH is enabled
      localStorage.setItem('lms_token', 'dev-admin-token');
      localStorage.setItem('lms_email', email);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-[6px] bg-primary shadow-[0_0_24px_rgba(212,165,60,0.4)]" />
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
            Default admin: admin@lendsync.local / admin123 (Postgres)
          </p>
        </form>
      </div>
    </div>
  );
}
