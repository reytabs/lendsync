'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  loan_type: string;
  annual_rate_percent: string | number;
  min_amount_cents: string | number;
  max_amount_cents: string | number;
  min_tenure_months: number;
  max_tenure_months: number;
  interest_method: string;
};

type EmiPreview = {
  monthlyEmiCents: number;
  totalInterestCents: number;
  totalRepaymentCents: number;
};

const steps = ['Product', 'Terms', 'Purpose', 'Review'] as const;

export default function PortalApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [purpose, setPurpose] = useState('');
  const [emi, setEmi] = useState<EmiPreview | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    void api<Product[]>('/loan-products').then((list) => {
      setProducts(list);
      if (list[0]) {
        setProductId(list[0].id);
        setAmount(String(Number(list[0].min_amount_cents) / 100));
        setTenure(String(list[0].min_tenure_months));
      }
    });
  }, []);

  useEffect(() => {
    if (!product || step !== 1) return;
    const principalCents = Math.round(Number(amount) * 100);
    const tenureMonths = Number(tenure);
    if (!principalCents || !tenureMonths) {
      setEmi(null);
      return;
    }
    void api<EmiPreview>('/repayments/calculate-emi', {
      method: 'POST',
      body: JSON.stringify({
        principalCents,
        annualRatePercent: Number(product.annual_rate_percent),
        tenureMonths,
        interestMethod: product.interest_method,
      }),
    })
      .then(setEmi)
      .catch(() => setEmi(null));
  }, [product, amount, tenure, step]);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(productId);
    if (step === 1) {
      if (!product) return false;
      const cents = Math.round(Number(amount) * 100);
      const t = Number(tenure);
      return (
        cents >= Number(product.min_amount_cents) &&
        cents <= Number(product.max_amount_cents) &&
        t >= product.min_tenure_months &&
        t <= product.max_tenure_months
      );
    }
    return true;
  }, [step, productId, product, amount, tenure]);

  async function create(submit: boolean) {
    if (!product) return;
    setSaving(true);
    setError('');
    try {
      const created = await api<{ id: string }>('/loans', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          principalCents: Math.round(Number(amount) * 100),
          tenureMonths: Number(tenure),
          purpose: purpose || undefined,
          loanType: product.loan_type,
        }),
      });
      if (submit) {
        await api(`/loans/${created.id}/submit`, { method: 'POST' });
      }
      router.push(`/portal/loans/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex gap-2">
        {steps.map((label, i) => (
          <div
            key={label}
            className={cn(
              'flex-1 rounded-md border px-2 py-2 text-center text-xs',
              i === step
                ? 'border-primary bg-primary/15 text-primary'
                : i < step
                  ? 'border-border text-foreground'
                  : 'border-border text-muted-foreground',
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id);
                  setAmount(String(Number(p.min_amount_cents) / 100));
                  setTenure(String(p.min_tenure_months));
                }}
                className={cn(
                  'w-full rounded-md border px-4 py-3 text-left transition-colors',
                  productId === p.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-white/5',
                )}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(p.annual_rate_percent)}% ·{' '}
                  {money(Number(p.min_amount_cents))}–
                  {money(Number(p.max_amount_cents))} · {p.min_tenure_months}–
                  {p.max_tenure_months} months
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 1 && product && (
        <Card>
          <CardHeader>
            <CardTitle>Loan terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Amount (USD)</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Tenure (months)</span>
                <Input
                  type="number"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Allowed {money(Number(product.min_amount_cents))}–
              {money(Number(product.max_amount_cents))},{' '}
              {product.min_tenure_months}–{product.max_tenure_months} months
            </p>
            {emi && (
              <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-black/20 p-4">
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    Monthly EMI
                  </div>
                  <div className="money text-sm font-semibold text-primary">
                    {money(emi.monthlyEmiCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    Total interest
                  </div>
                  <div className="money text-sm font-semibold">
                    {money(emi.totalInterestCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    Total payable
                  </div>
                  <div className="money text-sm font-semibold">
                    {money(emi.totalRepaymentCents)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">
                What will you use the loan for?
              </span>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Working capital, home renovation"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === 3 && product && (
        <Card>
          <CardHeader>
            <CardTitle>Review & submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Product" value={product.name} />
            <Row label="Amount" value={money(Math.round(Number(amount) * 100))} />
            <Row label="Tenure" value={`${tenure} months`} />
            <Row label="Rate" value={`${Number(product.annual_rate_percent)}%`} />
            <Row label="Purpose" value={purpose || '—'} />
            {emi && (
              <Row label="Est. EMI" value={money(emi.monthlyEmiCents)} />
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-chart-red">{error}</p>}

      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step === 3 ? (
            <>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => void create(false)}
              >
                Save draft
              </Button>
              <Button disabled={saving} onClick={() => void create(true)}>
                {saving ? 'Submitting…' : 'Submit application'}
              </Button>
            </>
          ) : (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
