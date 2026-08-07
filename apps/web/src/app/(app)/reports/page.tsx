'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ReportKpis = {
  avgLoanSizeCents: number;
  avgTenureMonths: number;
  avgInterestRatePercent: number;
  defaultRatePercent: number;
  recoveryRatePercent: number;
  niiThisMonthCents: number;
};

type Charts = {
  monthlyApplications: Array<{ month: string; count: number }>;
  repaymentQuality: Array<{
    month: string;
    onTime: number;
    late: number;
    default: number;
  }>;
  disbursementVsCollections: Array<{
    month: string;
    disbursed: number;
    collected: number;
  }>;
};

export default function ReportsPage() {
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [k, c] = await Promise.all([
        api<ReportKpis>('/reports/kpis'),
        api<Charts>('/reports/charts'),
      ]);
      setKpis(k);
      setCharts(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('lms_token')
        : null;
    const res = await fetch(`${API_URL}/api/reports/export.csv`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (!res.ok) {
      setError('CSV export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lendsync-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Loading reports…
      </p>
    );
  }

  if (!kpis || !charts) {
    return (
      <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
        {error || 'No report data'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Avg Loan Size"
          valueCents={kpis.avgLoanSizeCents}
          hint="Across loan book"
          delta={null}
          icon={<span />}
        />
        <KpiCard
          label="Avg Tenure"
          valueText={`${kpis.avgTenureMonths} mo`}
          hint="Simple average"
          delta={null}
          icon={<span />}
        />
        <KpiCard
          label="Avg Interest Rate"
          valueText={`${kpis.avgInterestRatePercent}%`}
          hint="Portfolio APR"
          delta={null}
          icon={<span />}
        />
        <KpiCard
          label="Default Rate"
          valueText={`${kpis.defaultRatePercent}%`}
          hint="Defaulted / all loans"
          delta={null}
          icon={<span />}
        />
        <KpiCard
          label="Recovery Rate"
          valueText={`${kpis.recoveryRatePercent}%`}
          hint="Completed vs defaulted"
          delta={null}
          icon={<span />}
        />
        <KpiCard
          label="Collections This Month"
          valueCents={kpis.niiThisMonthCents}
          hint="Sum of recorded repayments"
          delta={null}
          icon={<span />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Applications Volume</CardTitle>
            <p className="text-xs text-muted-foreground">
              New loan applications created per month
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlyApplications}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis dataKey="month" stroke="#6A6C7E" fontSize={12} />
                <YAxis stroke="#6A6C7E" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#12141a',
                    border: '1px solid #2a2d36',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="#D4A53C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Quality Trend</CardTitle>
            <p className="text-xs text-muted-foreground">
              Share of installments by outcome (% of due that month)
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.repaymentQuality}>
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
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="onTime"
                  stroke="#4ADE80"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="late"
                  stroke="#F97316"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="default"
                  stroke="#F87171"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disbursement vs Collections</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 12 months · amounts in USD
          </p>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.disbursementVsCollections}>
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
                formatter={(value: number) => money(Math.round(value * 100))}
              />
              <Legend />
              <Bar dataKey="disbursed" fill="#D4A53C" name="Disbursed" />
              <Bar dataKey="collected" fill="#2DD4BF" name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
