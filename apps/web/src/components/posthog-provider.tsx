'use client';

import posthog from 'posthog-js';
import { type ReactNode } from 'react';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== 'undefined' && !projectToken) {
  if (process.env.NODE_ENV === 'development') {
    throw new Error(
      'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
    );
  }
} else if (typeof window !== 'undefined' && projectToken && apiHost) {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
  });
} else if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  throw new Error(
    'NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured',
  );
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  return children;
}
