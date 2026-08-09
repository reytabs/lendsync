'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import posthog from 'posthog-js';
import { Plus, Trash2, X } from 'lucide-react';
import { creditScoreColor } from '@lms/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Money } from '@/components/money';

type Borrower = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  occupation?: string | null;
  credit_score?: number | null;
  kyc_status?: string;
  created_at: string;
  total_borrowed_cents?: string | number;
  active_loans?: string | number;
  on_time_rate?: string | number;
};

function formatSince(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function BorrowersPage() {
  const [q, setQ] = useState('');
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Borrower | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [creditScore, setCreditScore] = useState('700');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Borrower[]>('/borrowers');
      setBorrowers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load borrowers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return borrowers;
    return borrowers.filter(
      (b) =>
        b.full_name.toLowerCase().includes(term) ||
        (b.occupation ?? '').toLowerCase().includes(term) ||
        b.email.toLowerCase().includes(term),
    );
  }, [borrowers, q]);

  function resetForm() {
    setFullName('');
    setEmail('');
    setPhone('');
    setOccupation('');
    setCreditScore('700');
    setPassword('');
    setFormError('');
    setCreatedTempPassword(null);
  }

  function openForm() {
    resetForm();
    setOpen(true);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    setCreatedTempPassword(null);
    try {
      const score = creditScore.trim() ? Number(creditScore) : undefined;
      if (score != null && (score < 300 || score > 850)) {
        throw new Error('Credit score must be between 300 and 850');
      }

      const created = await api<Borrower & { tempPassword?: string }>(
        '/borrowers',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            occupation: occupation.trim() || undefined,
            creditScore: score,
            password: password.trim() || undefined,
          }),
        },
      );

      posthog.capture('borrower_created', {
        has_phone: Boolean(phone.trim()),
        has_occupation: Boolean(occupation.trim()),
        has_custom_password: Boolean(password.trim()),
      });
      if (created.tempPassword) {
        setCreatedTempPassword(created.tempPassword);
      } else {
        setOpen(false);
        resetForm();
      }
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirm() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    setError('');
    try {
      await api(`/borrowers/${confirmDelete.id}`, { method: 'DELETE' });
      posthog.capture('borrower_deleted');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setConfirmDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or occupation…"
          className="max-w-md"
        />
        <Button onClick={openForm}>
          <Plus className="h-4 w-4" />
          New borrower
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading borrowers…
        </p>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No borrowers found.</p>
          <Button className="mt-4" onClick={openForm}>
            <Plus className="h-4 w-4" />
            Add first borrower
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const score = Number(b.credit_score ?? 300);
            const color = creditScoreColor(score);
            const pct = ((score - 300) / 550) * 100;
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-semibold">
                        {b.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.occupation || '—'} · since{' '}
                        {formatSince(b.created_at)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {b.email}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Credit Score
                      </div>
                      <div
                        className="money text-lg font-semibold"
                        style={{ color }}
                      >
                        {b.credit_score ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, pct))}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Poor 300</span>
                    <span>Excellent 850</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                    <div>
                      <div className="money text-sm font-semibold">
                        {Number(b.on_time_rate ?? 100)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        On-time Rate
                      </div>
                    </div>
                    <div>
                      <div className="money text-sm font-semibold">
                        <Money cents={Number(b.total_borrowed_cents ?? 0)} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Total Borrowed
                      </div>
                    </div>
                    <div>
                      <div className="money text-sm font-semibold">
                        {Number(b.active_loans ?? 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Active Loans
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={deletingId === b.id}
                      onClick={() => setConfirmDelete(b)}
                      className="text-chart-red hover:bg-chart-red/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-surface w-full max-w-md space-y-4 p-5 shadow-2xl">
            <h2 className="font-display text-xl font-semibold">
              Delete borrower?
            </h2>
            <p className="text-sm text-muted-foreground">
              Remove <span className="text-foreground">{confirmDelete.full_name}</span>{' '}
              ({confirmDelete.email}). This also deletes their applications,
              documents, and closed loan history. Borrowers with active or
              approved loans cannot be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void onDeleteConfirm()}
                disabled={deletingId === confirmDelete.id}
                className="bg-[#F87171] text-black hover:bg-[#F87171]/90"
              >
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-surface w-full max-w-lg space-y-4 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  New borrower
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a borrower profile for loan applications.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createdTempPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-foreground">
                  Borrower created. Temporary password (copy now):
                </p>
                <code className="block rounded-md border border-border bg-black/40 px-3 py-2 font-mono text-sm text-primary">
                  {createdTempPassword}
                </code>
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onCreate} className="space-y-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Full name</span>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">Credit score</span>
                    <Input
                      type="number"
                      min={300}
                      max={850}
                      value={creditScore}
                      onChange={(e) => setCreditScore(e.target.value)}
                      placeholder="300–850"
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Occupation</span>
                  <Input
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Business Owner"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">
                    Password (optional)
                  </span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    placeholder="Auto-generate if empty"
                  />
                </label>

                {formError && (
                  <p className="text-sm text-chart-red">{formError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Create borrower'}
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
