import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Platform-wide currency, hydrated from admin settings at load time.
// Kept as module state so the many `money()` call sites don't each need a prop.
let currentCurrency = 'USD';

export function setCurrency(code?: string | null) {
  currentCurrency = (code || 'USD').toUpperCase();
}

export function getCurrency() {
  return currentCurrency;
}

export function money(cents: number, currency = currentCurrency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    // Fallback for non-ISO / unsupported codes
    const amount = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return `${currency} ${amount}`;
  }
}

/**
 * Splits a formatted amount into its currency symbol and numeric parts so the
 * symbol can be rendered separately. Some symbols (e.g. the peso sign ₱) are
 * missing from our display fonts and fall back to a mismatched system glyph;
 * rendering them in a controlled span lets us normalize their size.
 */
export function moneyParts(cents: number, currency = currentCurrency) {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(cents / 100);
    let symbol = '';
    let value = '';
    for (const part of parts) {
      if (part.type === 'currency') symbol += part.value;
      else value += part.value;
    }
    return { symbol, value: value.trim() };
  } catch {
    const value = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return { symbol: currency, value };
  }
}

/** Human-readable calendar date; keeps YYYY-MM-DD / ISO date part stable across timezones. */
export function formatDate(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

export function pct(n: number, digits = 1) {
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}
