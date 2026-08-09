'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { LoanDetailSkeleton } from '@/components/skeletons';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';

type Detail = {
  application: {
    id: string;
    status: string;
    principal_cents: string | number;
    tenure_months: number;
    annual_rate_percent: string | number;
    loan_type: string;
    purpose?: string | null;
    decision_notes?: string | null;
    created_at: string;
    submitted_at?: string | null;
  };
  loan?: {
    id: string;
    status: string;
    disbursed_at?: string | null;
  } | null;
  schedule: Array<{
    installment_no: number;
    due_date: string;
    principal_cents: string | number;
    interest_cents: string | number;
    total_cents: string | number;
    status: string;
    paid_cents?: string | number;
    remaining_cents?: string | number;
  }>;
};

export default function PortalLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setData(await api<Detail>(`/loans/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitDraft() {
    setSubmitting(true);
    setError('');
    try {
      await api(`/loans/${id}/submit`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!data && !error) {
    return <LoanDetailSkeleton />;
  }
  if (!data) {
    return <p className="text-sm text-chart-red">{error}</p>;
  }

  const app = data.application;
  const outstanding = (data.schedule ?? [])
    .filter((s) => s.status !== 'paid')
    .reduce((sum, s) => {
      const remaining =
        s.remaining_cents != null
          ? Number(s.remaining_cents)
          : Math.max(0, Number(s.total_cents) - Number(s.paid_cents ?? 0));
      return sum + remaining;
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/portal/loans')}>
            ← Back
          </Button>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold">
              <Money cents={Number(app.principal_cents)} /> · {app.tenure_months} months
            </h2>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {Number(app.annual_rate_percent)}% APR · {app.loan_type}
            {app.purpose ? ` · ${app.purpose}` : ''}
          </p>
        </div>
        {app.status === 'draft' && (
          <Button onClick={submitDraft} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-chart-red">{error}</p>}

      {app.status === 'rejected' && app.decision_notes && (
        <Card className="border-chart-red/40 bg-chart-red/10">
          <CardContent className="p-4 text-sm">
            <div className="font-semibold text-chart-red">Rejected</div>
            <p className="mt-1 text-muted-foreground">{app.decision_notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Outstanding EMI</div>
            <div className="money mt-1 text-xl font-semibold">
              <Money cents={outstanding} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Loan status</div>
            <div className="mt-2">
              <StatusBadge status={data.loan?.status ?? app.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Applied</div>
            <div className="mt-1 text-sm">
              {new Date(app.created_at).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repayment schedule</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!data.schedule?.length ? (
            <p className="text-sm text-muted-foreground">
              Schedule appears after approval.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                View only — payments are recorded by LendSync staff.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Due</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Paid</th>
                    <th className="pb-2">Remaining</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.schedule.map((row) => {
                    const paid = Number(row.paid_cents ?? 0);
                    const remaining =
                      row.remaining_cents != null
                        ? Number(row.remaining_cents)
                        : Math.max(0, Number(row.total_cents) - paid);
                    return (
                    <tr key={row.installment_no} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{row.installment_no}</td>
                      <td className="py-2">{formatDate(row.due_date)}</td>
                      <td className="money py-2">
                        <Money cents={Number(row.total_cents)} />
                      </td>
                      <td className="money py-2"><Money cents={paid} /></td>
                      <td className="money py-2"><Money cents={remaining} /></td>
                      <td className="py-2">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
