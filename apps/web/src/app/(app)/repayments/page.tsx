'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';

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
  loan_type: string;
  status: string;
  disbursed_at?: string | null;
  borrower?: { full_name?: string; email?: string } | null;
  next_installment?: Installment | null;
  unpaid_count?: number;
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
  const [loans, setLoans] = useState<DueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payLoan, setPayLoan] = useState<DueLoan | null>(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

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

  async function onDisburse(loan: DueLoan) {
    setBusyId(loan.id);
    setError('');
    try {
      await api('/disbursements', {
        method: 'POST',
        body: JSON.stringify({ loanId: loan.id }),
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
      closePay();
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Disburse approved loans, then record borrower EMI payments against the
        next unpaid installment.
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
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading loans…
            </p>
          ) : loans.length === 0 ? (
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
                {loans.map((loan) => {
                  const next = loan.next_installment;
                  const name = loan.borrower?.full_name ?? '—';
                  return (
                    <tr key={loan.id} className="border-b border-border/60">
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
                        {money(Number(loan.principal_cents))}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="money py-3">
                        {next ? money(Number(next.total_cents)) : '—'}
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
                              {money(Number(next.paid_cents ?? 0))} paid
                            </div>
                            <div className="money text-xs text-muted-foreground">
                              {money(
                                Number(
                                  next.remaining_cents ??
                                    Math.max(
                                      0,
                                      Number(next.total_cents) -
                                        Number(next.paid_cents ?? 0),
                                    ),
                                ),
                              )}{' '}
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
                        <div className="flex justify-end gap-2">
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
                        {money(Number(next.total_cents))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already paid</span>
                      <span className="money text-chart-green">
                        {money(paid)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
                      <span>Remaining</span>
                      <span className="money">{money(remaining)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Principal {money(Number(next.principal_cents))}
                      </span>
                      <span>
                        Interest {money(Number(next.interest_cents))}
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
                  Amount received now (USD)
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
    </div>
  );
}
