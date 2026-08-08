'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';

type AppRow = {
  id: string;
  status: string;
  principal_cents: string | number;
  loan_type: string;
  tenure_months: number;
  created_at: string;
  product?: { name?: string };
};

const typeLabel: Record<string, string> = {
  business: 'Business',
  personal: 'Personal',
  home_equity: 'Home Equity',
  auto: 'Auto',
  micro: 'Micro',
};

export default function PortalLoansPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setRows(await api<AppRow[]>('/loans'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/portal/apply">
          <Button>New application</Button>
        </Link>
      </div>
      {error && <p className="text-sm text-chart-red">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Your applications</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No loans yet.{' '}
              <Link href="/portal/apply" className="text-primary hover:underline">
                Apply now
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Tenure</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Applied</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3">
                      <Link
                        href={`/portal/loans/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.product?.name ?? 'Loan'}
                      </Link>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {typeLabel[row.loan_type] ?? row.loan_type}
                    </td>
                    <td className="money py-3">
                      <Money cents={Number(row.principal_cents)} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {row.tenure_months} mo
                    </td>
                    <td className="py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
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
