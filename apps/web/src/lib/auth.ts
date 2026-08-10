'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

export type AuthSession = {
  token: string;
  email: string;
  role: string;
  fullName?: string;
  orgId?: string;
  orgName?: string;
  orgRole?: string;
  mustChangePassword?: boolean;
};

export function getStoredAuth(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('lms_token');
  const role = localStorage.getItem('lms_role');
  const email = localStorage.getItem('lms_email') ?? '';
  const fullName = localStorage.getItem('lms_full_name') ?? undefined;
  const orgId = localStorage.getItem('lms_org_id') ?? undefined;
  const orgName = localStorage.getItem('lms_org_name') ?? undefined;
  const orgRole = localStorage.getItem('lms_org_role') ?? undefined;
  const mustChangePassword =
    localStorage.getItem('lms_must_change_password') === '1';
  if (!token || !role) return null;
  return {
    token,
    role,
    email,
    fullName,
    orgId,
    orgName,
    orgRole,
    mustChangePassword,
  };
}

export function setStoredAuth(data: {
  access_token: string;
  user: {
    email?: string;
    role?: string;
    full_name?: string;
    organization_id?: string;
    org_role?: string | null;
    must_change_password?: boolean;
  };
  /** Optional human-readable org name (not present in login/signup payloads). */
  orgName?: string;
}) {
  localStorage.setItem('lms_token', data.access_token);
  localStorage.setItem('lms_role', data.user.role ?? 'borrower');
  localStorage.setItem('lms_email', data.user.email ?? '');
  if (data.user.full_name) {
    localStorage.setItem('lms_full_name', data.user.full_name);
  }
  if (data.user.organization_id) {
    localStorage.setItem('lms_org_id', data.user.organization_id);
  }
  if (data.user.org_role) {
    localStorage.setItem('lms_org_role', data.user.org_role);
  } else {
    localStorage.removeItem('lms_org_role');
  }
  if (data.user.must_change_password) {
    localStorage.setItem('lms_must_change_password', '1');
  } else {
    localStorage.removeItem('lms_must_change_password');
  }
  if (data.orgName) {
    localStorage.setItem('lms_org_name', data.orgName);
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_role');
  localStorage.removeItem('lms_email');
  localStorage.removeItem('lms_full_name');
  localStorage.removeItem('lms_org_id');
  localStorage.removeItem('lms_org_name');
  localStorage.removeItem('lms_org_role');
  localStorage.removeItem('lms_must_change_password');
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
    if (auth.mustChangePassword) {
      router.replace('/change-password');
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
