'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Flips the `dark` class on <html> and persists the choice. Initial theme is
 * applied by the inline script in the root layout to avoid a flash.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark = root.classList.toggle('dark');
    const theme = isDark ? 'dark' : 'light';
    root.style.colorScheme = theme;
    try {
      localStorage.setItem('lms_theme', theme);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle light / dark theme"
    >
      {/* Icon reflects the action: sun in dark mode (switch to light), moon in light mode. */}
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="block h-4 w-4 dark:hidden" />
    </Button>
  );
}
