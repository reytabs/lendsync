'use client';

import { useMemo, useState } from 'react';
import type { InterestMethod } from '@lms/types';
import { calculateEmi } from '@lms/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/money';
import { cn } from '@/lib/utils';

const interestMethods: { value: InterestMethod; label: string; hint: string }[] =
  [
    {
      value: 'reducing',
      label: 'Reducing balance',
      hint: 'Interest on remaining principal (typical bank EMI)',
    },
    {
      value: 'flat',
      label: 'Flat rate',
      hint: 'Interest on original principal for the full term',
    },
  ];

export default function EmiCalculatorPage() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(12);
  const [tenure, setTenure] = useState(36);
  const [interestMethod, setInterestMethod] =
    useState<InterestMethod>('reducing');

  const result = useMemo(
    () =>
      calculateEmi({
        principalCents: Math.round(principal * 100),
        annualRatePercent: rate,
        tenureMonths: tenure,
        interestMethod,
      }),
    [principal, rate, tenure, interestMethod],
  );

  const chartData = result.schedule.slice(0, 12).map((row) => ({
    month: `M${row.month}`,
    principal: row.principalCents / 100,
    interest: row.interestCents / 100,
  }));

  const methodHint =
    interestMethods.find((m) => m.value === interestMethod)?.hint ?? '';

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader>
          <CardTitle>Loan Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderField
            label="Principal Amount"
            valueLabel={<Money cents={Math.round(principal * 100)} />}
            min={1000}
            max={500000}
            step={1000}
            value={principal}
            onChange={setPrincipal}
          />
          <SliderField
            label="Annual Interest Rate"
            valueLabel={`${rate.toFixed(1)}%`}
            min={1}
            max={30}
            step={0.1}
            value={rate}
            onChange={setRate}
          />
          <SliderField
            label="Loan Tenure (months)"
            valueLabel={`${tenure} mo`}
            min={3}
            max={120}
            step={1}
            value={tenure}
            onChange={setTenure}
          />

          <div className="space-y-2">
            <div className="text-sm">Interest method</div>
            <div className="grid grid-cols-2 gap-2">
              {interestMethods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setInterestMethod(m.value)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    interestMethod === m.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{methodHint}</p>
            {interestMethod === 'flat' && (
              <p className="text-xs text-muted-foreground">
                Same advertised rate is usually more expensive as flat than
                reducing.
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <Metric
              label="Monthly EMI"
              value={<Money cents={result.monthlyEmiCents} />}
            />
            <Metric
              label="Total Repayment"
              value={<Money cents={result.totalRepaymentCents} />}
            />
            <Metric
              label="Interest Paid"
              value={<Money cents={result.totalInterestCents} />}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Principal vs Interest (First 12 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <Bar dataKey="principal" stackId="a" fill="#D4A53C" name="Principal" />
                <Bar dataKey="interest" stackId="a" fill="#2DD4BF" name="Interest" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amortization Schedule</CardTitle>
            <p className="text-xs text-muted-foreground">
              First 12 months ·{' '}
              {interestMethod === 'flat' ? 'Flat rate' : 'Reducing balance'}
            </p>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Due</th>
                  <th className="pb-2">EMI</th>
                  <th className="pb-2">Principal</th>
                  <th className="pb-2">Interest</th>
                  <th className="pb-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.slice(0, 12).map((row) => (
                  <tr key={row.month} className="border-b border-border/50">
                    <td className="py-2">{row.month}</td>
                    <td className="py-2 text-muted-foreground">{row.dueDate}</td>
                    <td className="money py-2"><Money cents={row.paymentCents} /></td>
                    <td className="money py-2"><Money cents={row.principalCents} /></td>
                    <td className="money py-2"><Money cents={row.interestCents} /></td>
                    <td className="money py-2"><Money cents={row.balanceCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SliderField({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueLabel: React.ReactNode;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="money text-xs font-semibold text-primary">
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#D4A53C]"
      />
    </label>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="money text-sm font-semibold">{value}</span>
    </div>
  );
}
