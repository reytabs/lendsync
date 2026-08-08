'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { money, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';

type AppRow = {
  id: string;
  status: string;
  principal_cents: string | number;
  loan_type: string;
  created_at: string;
  product?: { name?: string };
};

type LoanDetail = {
  application: AppRow & { decision_notes?: string | null };
  loan?: { id: string; status: string } | null;
  schedule?: Array<{
    id: string;
    due_date: string;
    total_cents: string | number;
    status: string;
  }>;
};

export default function PortalHomePage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [nextDue, setNextDue] = useState<{
    date: string;
    amount: number;
    loanId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api<AppRow[]>('/loans');
        setApps(list);
        const active = list.find((a) =>
          ['approved', 'disbursed', 'active'].includes(a.status),
        );
        if (active) {
          const detail = await api<LoanDetail>(`/loans/${active.id}`);
          const upcoming = (detail.schedule ?? [])
            .filter((s) => ['upcoming', 'overdue', 'partial'].includes(s.status))
            .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
          if (upcoming) {
            setNextDue({
              date: upcoming.due_date,
              amount: Number(upcoming.total_cents),
              loanId: active.id,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nextAction = useMemo(() => {
    if (!apps.length) {
      return {
        title: 'Apply for a loan',
        body: 'Choose a product and submit your first application.',
        href: '/portal/apply',
        cta: 'Start application',
      };
    }
    const draft = apps.find((a) => a.status === 'draft');
    if (draft) {
      return {
        title: 'Continue application',
        body: 'You have a draft ready to finish and submit.',
        href: `/portal/loans/${draft.id}`,
        cta: 'Open draft',
      };
    }
    const pending = apps.find((a) =>
      ['submitted', 'under_review'].includes(a.status),
    );
    if (pending) {
      return {
        title: 'Application in review',
        body: 'Our team is reviewing your request. We’ll update status here.',
        href: `/portal/loans/${pending.id}`,
        cta: 'View status',
      };
    }
    if (nextDue) {
      return {
        title: `Next EMI due ${formatDate(nextDue.date)}`,
        body: `${money(nextDue.amount)} — view schedule for details. Payments are recorded by LendSync staff.`,
        href: `/portal/loans/${nextDue.loanId}`,
        cta: 'View schedule',
      };
    }
    return {
      title: 'You’re all set',
      body: 'Apply for another loan or review your documents.',
      href: '/portal/apply',
      cta: 'Apply again',
    };
  }, [apps, nextDue]);

  const recent = apps.slice(0, 5);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading your portal…</p>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="font-display text-lg font-semibold">
              {nextAction.title}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {nextAction.body}
            </p>
          </div>
          <Link href={nextAction.href}>
            <Button>{nextAction.cta}</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Applications</div>
            <div className="money mt-1 text-2xl font-semibold">{apps.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">In review</div>
            <div className="money mt-1 text-2xl font-semibold">
              {
                apps.filter((a) =>
                  ['submitted', 'under_review'].includes(a.status),
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active / approved</div>
            <div className="money mt-1 text-2xl font-semibold">
              {
                apps.filter((a) =>
                  ['approved', 'disbursed', 'active'].includes(a.status),
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent applications</CardTitle>
          <Link
            href="/portal/loans"
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-3">
                      <Link
                        href={`/portal/loans/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.product?.name ?? row.loan_type}
                      </Link>
                    </td>
                    <td className="money py-3">
                      <Money cents={Number(row.principal_cents)} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
