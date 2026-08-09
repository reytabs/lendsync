'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { DashboardSkeleton } from '@/components/skeletons';
import { formatDate, money } from '@/lib/utils';
import Link from 'next/link';

const typeLabel: Record<string, string> = {
  business: 'Business',
  personal: 'Personal',
  home_equity: 'Home',
  auto: 'Auto',
  micro: 'Micro',
};

type DashboardData = {
  kpis: {
    totalPortfolioCents: number;
    activeLoans: number;
    portfolioDeltaPercent: number | null;
    disbursedThisMonthCents: number;
    disbursementsCount: number;
    disbursedDeltaPercent: number | null;
    collectionsTodayCents: number;
    paymentsCount: number;
    collectionsDeltaPercent: number | null;
    portfolioAtRiskPercent: number;
    overdueCents: number;
    parDeltaPercent: number | null;
  };
  series: Array<{ month: string; disbursed: number; collected: number }>;
  portfolioBreakdown: Array<{
    type: string;
    label: string;
    percent: number;
    color: string;
    cents: number;
  }>;
  recentApplications: Array<{
    id: string;
    borrower: string;
    loan_type: string;
    principal_cents: string | number;
    status: string;
    officer: string | null;
    created_at: string;
  }>;
};

function shortId(id: string) {
  return id.length > 12 ? `LN-${id.slice(0, 8).toUpperCase()}` : id;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<DashboardData>('/reports/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
        {error || 'No dashboard data'}
      </p>
    );
  }

  const { kpis, series, portfolioBreakdown, recentApplications } = data;
  const portfolioTotal = portfolioBreakdown.reduce(
    (s, i) => s + Number(i.cents),
    0,
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Portfolio"
          valueCents={kpis.totalPortfolioCents}
          hint={`${kpis.activeLoans} active loans`}
          delta={kpis.portfolioDeltaPercent}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <KpiCard
          label="Disbursed This Month"
          valueCents={kpis.disbursedThisMonthCents}
          hint={`${kpis.disbursementsCount} new disbursements`}
          delta={kpis.disbursedDeltaPercent}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <KpiCard
          label="Collections Today"
          valueCents={kpis.collectionsTodayCents}
          hint={`${kpis.paymentsCount} payments received`}
          delta={kpis.collectionsDeltaPercent}
          deltaLabel="vs yesterday"
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Portfolio at Risk"
          valueText={`${kpis.portfolioAtRiskPercent}%`}
          hint={`${money(kpis.overdueCents)} overdue`}
          delta={kpis.parDeltaPercent}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Disbursement vs Collections</CardTitle>
            <p className="text-xs text-muted-foreground">
              Last 12 months · live from disbursements & repayments
            </p>
          </CardHeader>
          <CardContent className="h-72">
            {series.every((s) => s.disbursed === 0 && s.collected === 0) ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No disbursement or collection activity yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="gDisbursed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4A53C" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#D4A53C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis dataKey="month" stroke="#6A6C7E" fontSize={12} />
                  <YAxis stroke="#6A6C7E" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: '#12141a',
                      border: '1px solid #2a2d36',
                      borderRadius: 8,
                    }}
                    formatter={(value: number) =>
                      money(Math.round(value * 100))
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="disbursed"
                    stroke="#D4A53C"
                    fill="url(#gDisbursed)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="#2DD4BF"
                    fill="url(#gCollected)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">
              By loan type · <Money cents={portfolioTotal} /> active
            </p>
          </CardHeader>
          <CardContent>
            {portfolioBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No active loans yet.
              </p>
            ) : (
              <>
                <div className="mx-auto h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioBreakdown}
                        dataKey="percent"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {portfolioBreakdown.map((entry) => (
                          <Cell key={entry.type} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-4 space-y-2">
                  {portfolioBreakdown.map((item) => (
                    <li
                      key={item.type}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="money text-foreground">
                        {item.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Applications</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest loan requests and their current status
            </p>
          </div>
          <Link
            href="/applications"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recentApplications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No applications yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-medium">Loan ID</th>
                  <th className="pb-3 font-medium">Borrower</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Loan Officer</th>
                  <th className="pb-3 font-medium">Date Applied</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3 font-mono text-xs text-primary">
                      {shortId(row.id)}
                    </td>
                    <td className="py-3">{row.borrower}</td>
                    <td className="py-3 text-muted-foreground">
                      {typeLabel[row.loan_type] ?? row.loan_type}
                    </td>
                    <td className="money py-3">
                      <Money cents={Number(row.principal_cents)} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {row.officer ?? '—'}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(row.created_at)}
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
