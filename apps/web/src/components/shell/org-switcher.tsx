'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getStoredAuth, setStoredAuth } from '@/lib/auth';
import { CACHE_KEY as CURRENCY_CACHE_KEY } from '@/lib/currency';
import { listMyOrgs, switchOrg, type Organization } from '@/lib/orgs';

function planLabel(code: string | null) {
  if (!code) return null;
  return code.charAt(0).toUpperCase() + code.slice(1);
}

export function OrgSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentId, setCurrentId] = useState<string | undefined>(
    () => getStoredAuth()?.orgId,
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listMyOrgs()
      .then((data) => {
        if (!active) return;
        setOrgs(data);
        const stored = getStoredAuth();
        const current = data.find((o) => o.id === stored?.orgId) ?? data[0];
        if (current) {
          setCurrentId(current.id);
          // Backfill org name into the session for the sidebar/header.
          if (stored && stored.orgName !== current.name) {
            localStorage.setItem('lms_org_name', current.name);
          }
        }
      })
      .catch(() => {
        // Non-fatal: switcher just stays empty.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const current = orgs.find((o) => o.id === currentId);

  async function onSwitch(org: Organization) {
    if (org.id === currentId) {
      setOpen(false);
      return;
    }
    setSwitchingId(org.id);
    try {
      const res = await switchOrg(org.id);
      setStoredAuth({ ...res, orgName: org.name });
      // Force the next load to re-resolve the tenant's currency.
      localStorage.removeItem(CURRENCY_CACHE_KEY);
      toast.success(`Switched to ${org.name}`);
      window.location.assign('/dashboard');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not switch organization',
      );
      setSwitchingId(null);
    }
  }

  if (loading && !current) {
    return (
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-md border border-sidebar-border px-2 text-sm text-muted-foreground',
          collapsed && 'justify-center',
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {!collapsed && <span>Loading…</span>}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-white/5 px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10',
          collapsed && 'justify-center',
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/20 text-primary">
          <Building2 className="h-3.5 w-3.5" />
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {current.name}
              </span>
              <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {planLabel(current.plan_code) ?? current.role}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organizations
            </div>
            {orgs.map((org) => {
              const isCurrent = org.id === currentId;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => void onSwitch(org)}
                  disabled={switchingId != null}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-white/5',
                    isCurrent && 'bg-primary/10',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/20 text-primary">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {org.name}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                      {org.role}
                      {planLabel(org.plan_code)
                        ? ` · ${planLabel(org.plan_code)}`
                        : ''}
                    </span>
                  </span>
                  {switchingId === org.id ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    isCurrent && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
