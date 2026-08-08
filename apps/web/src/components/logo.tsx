import { cn } from '@/lib/utils';

/**
 * Theme-aware brand mark. Both images are rendered and toggled purely via CSS
 * `dark:` variants so there is no hydration mismatch or swap flicker.
 * - Dark theme: gold mark on transparent (`/logo-mark.png`).
 * - Light theme: gold mark inside a dark tile for contrast (`/logo-tile.png`).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/logo-tile.png"
        alt="LendSync"
        className={cn('block dark:hidden', className)}
      />
      <img
        src="/logo-mark.png"
        alt="LendSync"
        className={cn('hidden dark:block', className)}
      />
    </>
  );
}
