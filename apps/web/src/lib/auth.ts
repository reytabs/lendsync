'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

export type AuthSession = {
  token: string;
  email: string;
  role: string;
  fullName?: string;
};

export function getStoredAuth(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('lms_token');
  const role = localStorage.getItem('lms_role');
  const email = localStorage.getItem('lms_email') ?? '';
  const fullName = localStorage.getItem('lms_full_name') ?? undefined;
  if (!token || !role) return null;
  return { token, role, email, fullName };
}

export function setStoredAuth(data: {
  access_token: string;
  user: { email?: string; role?: string; full_name?: string };
}) {
  localStorage.setItem('lms_token', data.access_token);
  localStorage.setItem('lms_role', data.user.role ?? 'borrower');
  localStorage.setItem('lms_email', data.user.email ?? '');
  if (data.user.full_name) {
    localStorage.setItem('lms_full_name', data.user.full_name);
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_role');
  localStorage.removeItem('lms_email');
  localStorage.removeItem('lms_full_name');
}

let identifiedSessionToken: string | null = null;

/**
 * The login response does not expose a user primary key, so email is the only
 * available stable identifier for this client session.
 */
export function identifyAuthSession(session: AuthSession) {
  if (!session.email || identifiedSessionToken === session.token) return;
  if (identifiedSessionToken) posthog.reset();

  posthog.identify(session.email, {
    email: session.email,
    name: session.fullName,
    role: session.role,
  });
  identifiedSessionToken = session.token;
}

export function logoutAuthSession() {
  posthog.reset();
  identifiedSessionToken = null;
  clearStoredAuth();
}

export function homeForRole(role: string) {
  return role === 'borrower' ? '/portal' : '/dashboard';
}

/** Client auth gate for layouts. */
export function useAuthGate(opts: {
  allow: string[];
  redirectIfWrong: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const allowKey = opts.allow.slice().sort().join(',');

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }
    identifyAuthSession(auth);

    const allowed = allowKey.split(',');
    if (!allowed.includes(auth.role)) {
      router.replace(auth.role === 'borrower' ? '/portal' : opts.redirectIfWrong);
      return;
    }
    setSession(auth);
    setReady(true);
  }, [allowKey, opts.redirectIfWrong, router]);

  return { ready, session };
}
