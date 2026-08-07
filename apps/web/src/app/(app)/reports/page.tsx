'use client';

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
import { mockDashboard } from '@/lib/mock-data';

const monthlyApplications = [
  { month: 'Sep', count: 42 },
  { month: 'Oct', count: 55 },
  { month: 'Nov', count: 48 },
  { month: 'Dec', count: 61 },
  { month: 'Jan', count: 70 },
  { month: 'Feb', count: 66 },
  { month: 'Mar', count: 74 },
  { month: 'Apr', count: 69 },
  { month: 'May', count: 82 },
  { month: 'Jun', count: 77 },
  { month: 'Jul', count: 88 },
  { month: 'Aug', count: 86 },
];

const repaymentQuality = [
  { month: 'Sep', onTime: 92, late: 6, default: 2 },
  { month: 'Oct', onTime: 91, late: 7, default: 2 },
  { month: 'Nov', onTime: 93, late: 5, default: 2 },
  { month: 'Dec', onTime: 90, late: 7, default: 3 },
  { month: 'Jan', onTime: 94, late: 4, default: 2 },
  { month: 'Feb', onTime: 93, late: 5, default: 2 },
  { month: 'Mar', onTime: 92, late: 6, default: 2 },
  { month: 'Apr', onTime: 91, late: 6, default: 3 },
  { month: 'May', onTime: 93, late: 5, default: 2 },
  { month: 'Jun', onTime: 92, late: 6, default: 2 },
  { month: 'Jul', onTime: 94, late: 4, default: 2 },
  { month: 'Aug', onTime: 93, late: 5, default: 2 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const csv = 'metric,value\navg_loan_size,82000\ndefault_rate,2.4\n';
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'lendsync-report.csv';
            a.click();
          }}
        >
          Export CSV
        </Button>
        <Button variant="secondary" size="sm">
          Export PDF
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Avg Loan Size"
          valueCents={8200000}
          hint="Across active book"
          delta={4.2}
          icon={<span />}
        />
        <KpiCard
          label="Avg Tenure"
          valueText="36 mo"
          hint="Weighted by principal"
          delta={1.1}
          icon={<span />}
        />
        <KpiCard
          label="Avg Interest Rate"
          valueText="11.8%"
          hint="Portfolio APR"
          delta={-0.3}
          icon={<span />}
        />
        <KpiCard
          label="Default Rate"
          valueText="2.4%"
          hint="Trailing 12 months"
          delta={0.2}
          icon={<span />}
        />
        <KpiCard
          label="Recovery Rate"
          valueText="91.2%"
          hint="Collections on defaults"
          delta={1.5}
          icon={<span />}
        />
        <KpiCard
          label="NII This Month"
          valueCents={18400000}
          hint="Net interest income"
          delta={6.8}
          icon={<span />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Applications Volume</CardTitle>
            <p className="text-xs text-muted-foreground">
              New loan applications submitted per month
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyApplications}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="#6A6C7E" fontSize={12} />
                <YAxis stroke="#6A6C7E" fontSize={12} />
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
              On-time, late, and default rates as % of portfolio
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={repaymentQuality}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
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
                <Line type="monotone" dataKey="onTime" stroke="#4ADE80" strokeWidth={2} />
                <Line type="monotone" dataKey="late" stroke="#F97316" strokeWidth={2} />
                <Line type="monotone" dataKey="default" stroke="#F87171" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disbursement vs Collections</CardTitle>
          <p className="text-xs text-muted-foreground">Full-year comparison</p>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockDashboard.series}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
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
              <Bar dataKey="disbursed" fill="#D4A53C" name="Disbursed" />
              <Bar dataKey="collected" fill="#2DD4BF" name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
