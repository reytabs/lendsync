'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn, money } from '@/lib/utils';

const filters = [
  'all',
  'pending',
  'approved',
  'disbursed',
  'rejected',
  'closed',
] as const;

const typeLabel: Record<string, string> = {
  business: 'Business',
  personal: 'Personal',
  home_equity: 'Home Equity',
  auto: 'Auto',
  micro: 'Micro',
};

type Product = {
  id: string;
  name: string;
  loan_type: string;
  annual_rate_percent: string | number;
  min_amount_cents: string | number;
  max_amount_cents: string | number;
  min_tenure_months: number;
  max_tenure_months: number;
};

type Borrower = {
  id: string;
  full_name: string;
  email: string;
};

type ApplicationRow = {
  id: string;
  principal_cents: string | number;
  status: string;
  loan_type: string;
  created_at: string;
  tenure_months?: number;
  purpose?: string | null;
  borrower?: { full_name?: string; email?: string } | string | null;
  officer?: { full_name?: string } | string | null;
  product?: { name?: string } | null;
};

function normalizeStatus(status: string) {
  if (['submitted', 'under_review', 'draft', 'pending'].includes(status)) {
    return 'pending';
  }
  if (['completed', 'closed', 'defaulted'].includes(status)) return 'closed';
  if (status === 'active') return 'disbursed';
  return status;
}

function borrowerName(row: ApplicationRow) {
  if (typeof row.borrower === 'string') return row.borrower;
  return row.borrower?.full_name ?? '—';
}

function officerName(row: ApplicationRow) {
  if (typeof row.officer === 'string') return row.officer;
  return row.officer?.full_name ?? null;
}

function shortId(id: string) {
  return id.length > 12 ? `LN-${id.slice(0, 8).toUpperCase()}` : id;
}

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

export default function ApplicationsPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [page, setPage] = useState(1);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [productId, setProductId] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [amount, setAmount] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitAfterCreate, setSubmitAfterCreate] = useState(true);

  const pageSize = 8;
  const selectedProduct = products.find((p) => p.id === productId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [apps, prods, people] = await Promise.all([
        api<ApplicationRow[]>('/loans'),
        api<Product[]>('/loan-products'),
        api<Borrower[]>('/borrowers'),
      ]);
      setApplications(apps);
      setProducts(prods);
      setBorrowers(people);
      if (!productId && prods[0]) setProductId(prods[0].id);
      if (!borrowerId && people[0]) setBorrowerId(people[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [productId, borrowerId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    const min = Number(selectedProduct.min_amount_cents) / 100;
    const maxTenure = selectedProduct.max_tenure_months;
    if (!amount) setAmount(String(min));
    if (!tenureMonths) {
      setTenureMonths(
        String(
          Math.min(
            Math.max(selectedProduct.min_tenure_months, 12),
            maxTenure,
          ),
        ),
      );
    }
  }, [selectedProduct, amount, tenureMonths]);

  const filtered = useMemo(() => {
    if (filter === 'all') return applications;
    return applications.filter((a) => normalizeStatus(a.status) === filter);
  }, [applications, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openForm() {
    setFormError('');
    if (products[0] && !productId) setProductId(products[0].id);
    if (borrowers[0] && !borrowerId) setBorrowerId(borrowers[0].id);
    setOpen(true);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (!productId) throw new Error('Select a loan product');
      if (!borrowerId) throw new Error('Select a borrower');
      const principalCents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(principalCents) || principalCents <= 0) {
        throw new Error('Enter a valid amount');
      }
      const tenure = Number(tenureMonths);
      if (!Number.isFinite(tenure) || tenure < 1) {
        throw new Error('Enter a valid tenure');
      }
      if (selectedProduct) {
        if (
          principalCents < Number(selectedProduct.min_amount_cents) ||
          principalCents > Number(selectedProduct.max_amount_cents)
        ) {
          throw new Error(
            `Amount must be between ${money(Number(selectedProduct.min_amount_cents))} and ${money(Number(selectedProduct.max_amount_cents))}`,
          );
        }
        if (
          tenure < selectedProduct.min_tenure_months ||
          tenure > selectedProduct.max_tenure_months
        ) {
          throw new Error(
            `Tenure must be ${selectedProduct.min_tenure_months}–${selectedProduct.max_tenure_months} months`,
          );
        }
      }

      const created = await api<{ id: string }>('/loans', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          borrowerId,
          principalCents,
          tenureMonths: tenure,
          purpose: purpose || undefined,
          loanType: selectedProduct?.loan_type,
        }),
      });

      if (submitAfterCreate && created.id) {
        await api(`/loans/${created.id}/submit`, { method: 'POST' });
      }

      setOpen(false);
      setPurpose('');
      setPage(1);
      setFilter(submitAfterCreate ? 'pending' : 'all');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs capitalize transition-colors',
                filter === f
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:bg-white/5',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Button onClick={openForm}>
          <Plus className="h-4 w-4" />
          New application
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All applications</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading applications…
            </p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No applications yet.
              </p>
              <Button className="mt-4" onClick={openForm}>
                <Plus className="h-4 w-4" />
                Create first application
              </Button>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3">Loan ID</th>
                    <th className="pb-3">Borrower</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Officer</th>
                    <th className="pb-3">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-3 font-mono text-xs text-primary">
                        {shortId(row.id)}
                      </td>
                      <td className="py-3">{borrowerName(row)}</td>
                      <td className="py-3 text-muted-foreground">
                        {typeLabel[row.loan_type] ?? row.loan_type}
                      </td>
                      <td className="money py-3">
                        {money(Number(row.principal_cents))}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {officerName(row) ?? 'Unassigned'}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, filtered.length)} of{' '}
                  {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-surface w-full max-w-lg space-y-4 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  New loan application
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a draft or submit it for review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onCreate} className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Borrower</span>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-black/30 px-3 text-sm"
                  value={borrowerId}
                  onChange={(e) => setBorrowerId(e.target.value)}
                  required
                >
                  <option value="">Select borrower…</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name} ({b.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Loan product</span>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-black/30 px-3 text-sm"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setAmount('');
                    setTenureMonths('');
                  }}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {Number(p.annual_rate_percent)}% ·{' '}
                      {typeLabel[p.loan_type] ?? p.loan_type}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProduct && (
                <p className="text-xs text-muted-foreground">
                  Amount{' '}
                  {money(Number(selectedProduct.min_amount_cents))}–
                  {money(Number(selectedProduct.max_amount_cents))} · Tenure{' '}
                  {selectedProduct.min_tenure_months}–
                  {selectedProduct.max_tenure_months} months
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Amount (USD)</span>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Tenure (months)</span>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Purpose</span>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Working capital"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={submitAfterCreate}
                  onChange={(e) => setSubmitAfterCreate(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                Submit for review immediately
              </label>

              {formError && (
                <p className="text-sm text-chart-red">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : submitAfterCreate
                      ? 'Create & submit'
                      : 'Save draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
