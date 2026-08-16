'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { Banknote, RefreshCw, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { TableSkeleton } from '@/components/skeletons';
import { useCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getStoredAuth } from '@/lib/auth';

type Installment = {
  id: string;
  installment_no: number;
  due_date: string;
  total_cents: string | number;
  principal_cents: string | number;
  interest_cents: string | number;
  status: string;
  paid_cents?: string | number;
  remaining_cents?: string | number;
};

type DueLoan = {
  id: string;
  application_id: string;
  principal_cents: string | number;
  tenure_months: number;
  annual_rate_percent: string | number;
  interest_method?: string;
  loan_type: string;
  status: string;
  disbursed_at?: string | null;
  borrower?: { full_name?: string; email?: string } | null;
  next_installment?: Installment | null;
  unpaid_count?: number;
};

type PayoffQuote = {
  loanId: string;
  outstandingPrincipalCents: number;
  outstandingInterestCents: number;
  outstandingTotalCents: number;
  payoffFullCents: number;
  payoffWaiveInterestCents: number;
  unpaidInstallments: number;
  tenureMonths: number;
  annualRatePercent: number;
};

const typeLabel: Record<string, string> = {
  business: 'Business',
  personal: 'Personal',
  home_equity: 'Home Equity',
  auto: 'Auto',
  micro: 'Micro',
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return value;
  }
}

function shortId(id: string) {
  return id.length > 12 ? `LN-${id.slice(0, 8).toUpperCase()}` : id;
}

export default function RepaymentsPage() {
  const currency = useCurrency();
  const searchParams = useSearchParams();
  const highlightLoanId = searchParams.get('loanId');
  const canRestructure = (() => {
    const role = getStoredAuth()?.role;
    return role === 'admin' || role === 'loan_officer';
  })();

  const [loans, setLoans] = useState<DueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payLoan, setPayLoan] = useState<DueLoan | null>(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const [manageLoan, setManageLoan] = useState<DueLoan | null>(null);
  const [manageTab, setManageTab] = useState<'settle' | 'restructure'>('settle');
  const [quote, setQuote] = useState<PayoffQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [waiveInterest, setWaiveInterest] = useState(false);
  const [settleNotes, setSettleNotes] = useState('');
  const [restructureKind, setRestructureKind] = useState<
    'tenure_change' | 'payment_holiday' | 'rate_change'
  >('tenure_change');
  const [newTenureMonths, setNewTenureMonths] = useState('12');
  const [newRate, setNewRate] = useState('');
  const [holidayMonths, setHolidayMonths] = useState('1');
  const [restructureNotes, setRestructureNotes] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api<DueLoan[]>('/repayments/due');
      setLoans(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!manageLoan) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setManageError('');
    void api<PayoffQuote>(`/repayments/loans/${manageLoan.id}/payoff`)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setNewTenureMonths(String(Math.max(1, q.unpaidInstallments)));
        setNewRate(String(q.annualRatePercent));
      })
      .catch((err) => {
        if (cancelled) return;
        setManageError(
          err instanceof Error ? err.message : 'Failed to load payoff quote',
        );
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manageLoan]);

  function openPay(loan: DueLoan) {
    if (!loan.next_installment) return;
    const next = loan.next_installment;
    const remaining =
      next.remaining_cents != null
        ? Number(next.remaining_cents)
        : Math.max(0, Number(next.total_cents) - Number(next.paid_cents ?? 0));
    setPayLoan(loan);
    setAmount((remaining / 100).toFixed(2));
    setPayError('');
  }

  function closePay() {
    setPayLoan(null);
    setAmount('');
    setPayError('');
  }

  function openManage(loan: DueLoan) {
    setManageLoan(loan);
    setManageTab('settle');
    setWaiveInterest(false);
    setSettleNotes('');
    setRestructureKind('tenure_change');
    setHolidayMonths('1');
    setRestructureNotes('');
    setManageError('');
  }

  function closeManage() {
    setManageLoan(null);
    setQuote(null);
    setManageError('');
  }

  async function onDisburse(loan: DueLoan) {
    setBusyId(loan.id);
    setError('');
    try {
      await api('/disbursements', {
        method: 'POST',
        body: JSON.stringify({ loanId: loan.id }),
      });
      posthog.capture('loan_disbursed', {
        loan_type: loan.loan_type,
        principal_cents: Number(loan.principal_cents),
        tenure_months: loan.tenure_months,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disbursement failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payLoan?.next_installment) return;
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      setPayError('Enter a valid amount');
      return;
    }
    setPaying(true);
    setPayError('');
    setBusyId(payLoan.id);
    try {
      await api('/repayments', {
        method: 'POST',
        body: JSON.stringify({
          loanId: payLoan.id,
          scheduleId: payLoan.next_installment.id,
          amountCents,
        }),
      });
      posthog.capture('repayment_recorded', {
        loan_type: payLoan.loan_type,
        installment_number: payLoan.next_installment.installment_no,
        amount_cents: amountCents,
      });
      closePay();
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
      setBusyId(null);
    }
  }

  async function onEarlySettle(e: React.FormEvent) {
    e.preventDefault();
    if (!manageLoan) return;
    setManageBusy(true);
    setManageError('');
    try {
      await api(`/repayments/loans/${manageLoan.id}/early-settle`, {
        method: 'POST',
        body: JSON.stringify({
          waiveInterest,
          notes: settleNotes.trim() || undefined,
        }),
      });
      posthog.capture('loan_early_settled', {
        loan_id: manageLoan.id,
        waive_interest: waiveInterest,
      });
      closeManage();
      await load();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setManageBusy(false);
    }
  }

  async function onRestructure(e: React.FormEvent) {
    e.preventDefault();
    if (!manageLoan) return;
    setManageBusy(true);
    setManageError('');
    try {
      const body: Record<string, unknown> = {
        kind: restructureKind,
        notes: restructureNotes.trim() || undefined,
      };
      if (restructureKind === 'tenure_change') {
        body.newTenureMonths = Number(newTenureMonths);
        if (newRate !== '') body.newAnnualRatePercent = Number(newRate);
      } else if (restructureKind === 'rate_change') {
        body.newAnnualRatePercent = Number(newRate);
      } else {
        body.holidayMonths = Number(holidayMonths);
      }
      await api(`/repayments/loans/${manageLoan.id}/restructure`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      posthog.capture('loan_restructured', {
        loan_id: manageLoan.id,
        kind: restructureKind,
      });
      closeManage();
      await load();
    } catch (err) {
      setManageError(
        err instanceof Error ? err.message : 'Restructure failed',
      );
    } finally {
      setManageBusy(false);
    }
  }

  const settleAmount = quote
    ? waiveInterest
      ? quote.payoffWaiveInterestCents
      : quote.payoffFullCents
    : 0;

  const orderedLoans =
    highlightLoanId && loans.some((l) => l.id === highlightLoanId)
      ? [
          ...loans.filter((l) => l.id === highlightLoanId),
          ...loans.filter((l) => l.id !== highlightLoanId),
        ]
      : loans;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Disburse approved loans, record EMI payments, settle early, or
        restructure remaining tenure and rates.
      </p>

      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active loan book</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : orderedLoans.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No approved or active loans yet. Approve an application first.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3">Loan</th>
                  <th className="pb-3">Borrower</th>
                  <th className="pb-3">Principal</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Next EMI</th>
                  <th className="pb-3">Paid / Remaining</th>
                  <th className="pb-3">Due</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderedLoans.map((loan) => {
                  const next = loan.next_installment;
                  const name = loan.borrower?.full_name ?? '—';
                  return (
                    <tr
                      key={loan.id}
                      className={cn(
                        'border-b border-border/60',
                        highlightLoanId === loan.id && 'bg-primary/10',
                      )}
                    >
                      <td className="py-3">
                        <div className="font-mono text-xs text-primary">
                          {shortId(loan.id)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {typeLabel[loan.loan_type] ?? loan.loan_type} ·{' '}
                          {loan.tenure_months} mo
                        </div>
                      </td>
                      <td className="py-3">
                        <div>{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {loan.borrower?.email}
                        </div>
                      </td>
                      <td className="money py-3">
                        <Money cents={Number(loan.principal_cents)} />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="money py-3">
                        {next ? <Money cents={Number(next.total_cents)} /> : '—'}
                        {next && (
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={next.status} />
                            <span className="text-xs text-muted-foreground">
                              #{next.installment_no}
                              {loan.unpaid_count != null
                                ? ` · ${loan.unpaid_count} unpaid`
                                : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        {next ? (
                          <>
                            <div className="money text-chart-green">
                              <Money cents={Number(next.paid_cents ?? 0)} /> paid
                            </div>
                            <div className="money text-xs text-muted-foreground">
                              <Money
                                cents={Number(
                                  next.remaining_cents ??
                                    Math.max(
                                      0,
                                      Number(next.total_cents) -
                                        Number(next.paid_cents ?? 0),
                                    ),
                                )}
                              />{' '}
                              left
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {next ? formatDate(String(next.due_date)) : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {loan.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busyId === loan.id}
                              onClick={() => onDisburse(loan)}
                            >
                              Disburse
                            </Button>
                          )}
                          {next ? (
                            <Button
                              size="sm"
                              disabled={busyId === loan.id}
                              onClick={() => openPay(loan)}
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              Record payment
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Paid up
                            </span>
                          )}
                          {canRestructure &&
                            loan.status !== 'approved' &&
                            next && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busyId === loan.id}
                              onClick={() => openManage(loan)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Restructure
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {payLoan && payLoan.next_installment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-surface w-full max-w-md space-y-4 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Record payment
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {payLoan.borrower?.full_name ?? 'Borrower'} · Installment #
                  {payLoan.next_installment.installment_no} · Due{' '}
                  {formatDate(String(payLoan.next_installment.due_date))}
                </p>
              </div>
              <button
                type="button"
                onClick={closePay}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onRecordPayment} className="space-y-3">
              {(() => {
                const next = payLoan.next_installment!;
                const paid = Number(next.paid_cents ?? 0);
                const remaining =
                  next.remaining_cents != null
                    ? Number(next.remaining_cents)
                    : Math.max(0, Number(next.total_cents) - paid);
                return (
                  <div className="rounded-md border border-border bg-black/20 p-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EMI total</span>
                      <span className="money">
                        <Money cents={Number(next.total_cents)} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already paid</span>
                      <span className="money text-chart-green">
                        <Money cents={paid} />
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
                      <span>Remaining</span>
                      <span className="money">
                        <Money cents={remaining} />
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Principal <Money cents={Number(next.principal_cents)} />
                      </span>
                      <span>
                        Interest <Money cents={Number(next.interest_cents)} />
                      </span>
                    </div>
                    {next.status === 'partial' && (
                      <p className="text-xs text-[#F97316]">
                        This installment is partially paid — enter the next
                        amount received.
                      </p>
                    )}
                  </div>
                );
              })()}

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">
                  Amount received now ({currency})
                </span>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Defaults to remaining balance. Less than remaining keeps it
                  partial.
                </span>
              </label>

              {payError && (
                <p className="text-sm text-chart-red">{payError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closePay}
                  disabled={paying}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={paying}>
                  {paying ? 'Saving…' : 'Confirm payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-surface w-full max-w-lg space-y-4 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Loan adjustments
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {manageLoan.borrower?.full_name ?? 'Borrower'} ·{' '}
                  {shortId(manageLoan.id)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeManage}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-border pb-2">
              <Button
                type="button"
                size="sm"
                variant={manageTab === 'settle' ? 'default' : 'secondary'}
                onClick={() => setManageTab('settle')}
              >
                Early settlement
              </Button>
              <Button
                type="button"
                size="sm"
                variant={manageTab === 'restructure' ? 'default' : 'secondary'}
                onClick={() => setManageTab('restructure')}
              >
                Restructure
              </Button>
            </div>

            {quoteLoading && (
              <p className="text-sm text-muted-foreground">
                Loading payoff quote…
              </p>
            )}

            {quote && !quoteLoading && (
              <div className="rounded-md border border-border bg-black/20 p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Outstanding principal
                  </span>
                  <span className="money">
                    <Money cents={quote.outstandingPrincipalCents} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Outstanding interest
                  </span>
                  <span className="money">
                    <Money cents={quote.outstandingInterestCents} />
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
                  <span>Full payoff</span>
                  <span className="money">
                    <Money cents={quote.payoffFullCents} />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {quote.unpaidInstallments} unpaid installment
                  {quote.unpaidInstallments === 1 ? '' : 's'} ·{' '}
                  {quote.tenureMonths} mo tenure · {quote.annualRatePercent}%
                </p>
              </div>
            )}

            {manageTab === 'settle' ? (
              <form onSubmit={onEarlySettle} className="space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={waiveInterest}
                    onChange={(e) => setWaiveInterest(e.target.checked)}
                  />
                  <span>
                    Waive remaining interest
                    {quote ? (
                      <>
                        {' '}
                        (
                        <Money cents={quote.outstandingInterestCents} />)
                      </>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Collect principal only and close the loan.
                    </span>
                  </span>
                </label>

                <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  Settlement amount:{' '}
                  <span className="money font-semibold">
                    <Money cents={settleAmount} />
                  </span>
                </div>

                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Notes (optional)</span>
                  <Input
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="Reason for early settlement"
                  />
                </label>

                {manageError && (
                  <p className="text-sm text-chart-red">{manageError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeManage}
                    disabled={manageBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={manageBusy || quoteLoading || settleAmount < 1}
                  >
                    {manageBusy ? 'Settling…' : 'Confirm settlement'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={onRestructure} className="space-y-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Change type</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                    value={restructureKind}
                    onChange={(e) =>
                      setRestructureKind(
                        e.target.value as
                          | 'tenure_change'
                          | 'payment_holiday'
                          | 'rate_change',
                      )
                    }
                  >
                    <option value="tenure_change">
                      Change remaining tenure
                    </option>
                    <option value="payment_holiday">Payment holiday</option>
                    <option value="rate_change">Change interest rate</option>
                  </select>
                </label>

                {restructureKind === 'tenure_change' && (
                  <>
                    <label className="block space-y-1.5 text-sm">
                      <span className="text-muted-foreground">
                        New remaining months
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={360}
                        value={newTenureMonths}
                        onChange={(e) => setNewTenureMonths(e.target.value)}
                        required
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm">
                      <span className="text-muted-foreground">
                        Annual rate % (optional)
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                      />
                    </label>
                  </>
                )}

                {restructureKind === 'rate_change' && (
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">
                      New annual rate %
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      required
                    />
                  </label>
                )}

                {restructureKind === 'payment_holiday' && (
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">
                      Shift unpaid due dates by (months)
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={holidayMonths}
                      onChange={(e) => setHolidayMonths(e.target.value)}
                      required
                    />
                  </label>
                )}

                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Notes (optional)</span>
                  <Input
                    value={restructureNotes}
                    onChange={(e) => setRestructureNotes(e.target.value)}
                    placeholder="Reason for restructuring"
                  />
                </label>

                {manageError && (
                  <p className="text-sm text-chart-red">{manageError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeManage}
                    disabled={manageBusy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={manageBusy || quoteLoading}>
                    {manageBusy ? 'Saving…' : 'Apply restructure'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
