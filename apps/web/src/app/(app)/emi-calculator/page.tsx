'use client';

import { useMemo, useState } from 'react';
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
import { money } from '@/lib/utils';

export default function EmiCalculatorPage() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(12);
  const [tenure, setTenure] = useState(36);

  const result = useMemo(
    () =>
      calculateEmi({
        principalCents: Math.round(principal * 100),
        annualRatePercent: rate,
        tenureMonths: tenure,
        interestMethod: 'reducing',
      }),
    [principal, rate, tenure],
  );

  const chartData = result.schedule.slice(0, 12).map((row) => ({
    month: `M${row.month}`,
    principal: row.principalCents / 100,
    interest: row.interestCents / 100,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader>
          <CardTitle>Loan Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderField
            label="Principal Amount"
            valueLabel={money(Math.round(principal * 100))}
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
          <div className="space-y-3 rounded-md border border-border bg-black/20 p-4">
            <Metric label="Monthly EMI" value={money(result.monthlyEmiCents)} />
            <Metric
              label="Total Repayment"
              value={money(result.totalRepaymentCents)}
            />
            <Metric
              label="Interest Paid"
              value={money(result.totalInterestCents)}
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
            <p className="text-xs text-muted-foreground">First 12 months shown</p>
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
                    <td className="money py-2">{money(row.paymentCents)}</td>
                    <td className="money py-2">{money(row.principalCents)}</td>
                    <td className="money py-2">{money(row.interestCents)}</td>
                    <td className="money py-2">{money(row.balanceCents)}</td>
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
  valueLabel: string;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="money text-sm font-semibold">{value}</span>
    </div>
  );
}
