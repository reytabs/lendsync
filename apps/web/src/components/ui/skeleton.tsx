import { cn } from '@/lib/utils';

/**
 * Base skeleton block. Uses `bg-foreground/10` so it reads correctly in both
 * light and dark themes, with a subtle pulse animation.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-foreground/10', className)}
    />
  );
}
