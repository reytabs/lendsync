'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { setCurrency as setGlobalCurrency } from './utils';

export const CACHE_KEY = 'lms_currency';
export const CURRENCY_CHANGED_EVENT = 'lms-currency-changed';

const CurrencyContext = createContext<string>('USD');

export function useCurrency() {
  return useContext(CurrencyContext);
}

/** Broadcast a currency change so every mounted provider updates without a reload. */
export function broadcastCurrency(code: string) {
  const next = (code || 'USD').toUpperCase();
  setGlobalCurrency(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(CACHE_KEY, next);
    window.dispatchEvent(
      new CustomEvent(CURRENCY_CHANGED_EVENT, { detail: next }),
    );
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        // Sync the module-level value before children first render.
        setGlobalCurrency(cached);
        return cached;
      }
    }
    return 'USD';
  });

  useEffect(() => {
    let active = true;
    api<{ currency?: string }>('/settings/public')
      .then((res) => {
        if (!active || !res?.currency) return;
        const next = res.currency.toUpperCase();
        setGlobalCurrency(next);
        setCurrencyState(next);
        localStorage.setItem(CACHE_KEY, next);
      })
      .catch(() => {
        // Non-fatal: keep cached/default currency.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onChange(e: Event) {
      const next = (e as CustomEvent<string>).detail;
      if (next) setCurrencyState(next);
    }
    window.addEventListener(CURRENCY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CURRENCY_CHANGED_EVENT, onChange);
  }, []);

  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}
