'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from '@/components/posthog-provider';

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <main>
            <h1>Something went wrong</h1>
            <p>Please try again.</p>
            <button type="button" onClick={reset}>
              Try again
            </button>
          </main>
        </PostHogProvider>
      </body>
    </html>
  );
}
