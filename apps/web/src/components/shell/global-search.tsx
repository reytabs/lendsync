'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  User,
  FileText,
  Banknote,
  Users,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type SearchHit = {
  type: 'borrower' | 'application' | 'loan' | 'staff';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const typeIcon = {
  borrower: User,
  application: FileText,
  loan: Banknote,
  staff: Users,
} as const;

const typeLabel = {
  borrower: 'Borrower',
  application: 'Application',
  loan: 'Loan',
  staff: 'Staff',
} as const;

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, 220);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHits([]);
    setActive(0);
    setError('');
  }, []);

  const openPalette = useCallback((seed = '') => {
    setOpen(true);
    setQuery(seed);
    setActive(0);
    setError('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else openPalette();
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close, openPalette]);

  useEffect(() => {
    if (!open) return;
    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void api<SearchHit[]>(`/search?q=${encodeURIComponent(term)}&limit=8`)
      .then((rows) => {
        if (cancelled) return;
        setHits(rows);
        setActive(0);
      })
      .catch((err) => {
        if (cancelled) return;
        setHits([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  function goTo(hit: SearchHit) {
    close();
    router.push(hit.href);
  }

  function onPaletteKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      goTo(hits[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        className="field-control relative hidden w-56 cursor-pointer items-center gap-2 pr-2 text-left md:flex"
        onClick={() => openPalette()}
        aria-label="Open quick search"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          Quick search…
        </span>
        <kbd className="pointer-events-none hidden shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>
      <ButtonIconMobile onClick={() => openPalette()} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="card-surface w-full max-w-xl overflow-hidden shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onPaletteKeyDown}
                placeholder="Search borrowers, loans, applications, staff…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {error && (
                <p className="px-2 py-3 text-sm text-chart-red">{error}</p>
              )}
              {!error && query.trim().length < 2 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters. Use ↑↓ to move, Enter to open.
                </p>
              )}
              {!error &&
                query.trim().length >= 2 &&
                !loading &&
                hits.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No matches for “{query.trim()}”
                  </p>
                )}
              {hits.map((hit, index) => {
                const Icon = typeIcon[hit.type];
                const selected = index === active;
                return (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => goTo(hit)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                      selected
                        ? 'bg-primary/15 text-foreground'
                        : 'hover:bg-white/5',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                        selected ? 'bg-primary/20 text-primary' : 'bg-muted/60',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {typeLabel[hit.type]} · {hit.subtitle}
                      </span>
                    </span>
                    {selected && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span>Navigate with keyboard</span>
              <span>
                <kbd className="rounded border border-border px-1">esc</kbd> to
                close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ButtonIconMobile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
