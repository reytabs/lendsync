'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { FormSkeleton, TableSkeleton } from '@/components/skeletons';
import { broadcastCurrency, useCurrency } from '@/lib/currency';
import { cn, formatDate } from '@/lib/utils';

const tabs = [
  'General',
  'Loan Products',
  'Users & Roles',
  'Integrations',
  'Security',
] as const;

const currencyOptions = [
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'PHP', label: 'PHP — Philippine Peso (₱)' },
] as const;

type OrganizationSettings = { name?: string; currency?: string };
type SettingsResponse = {
  organization?: OrganizationSettings;
};

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('General');
  const [orgName, setOrgName] = useState('');
  const [currency, setCurrency] = useState('');
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [require2fa, setRequire2fa] = useState(false);
  const [enforceTls, setEnforceTls] = useState(true);
  const [autoBackups, setAutoBackups] = useState(true);

  const loadSettings = useCallback(async () => {
    setGeneralLoading(true);
    setGeneralError('');
    try {
      const data = await api<SettingsResponse>('/admin/settings');
      setOrgName(data.organization?.name ?? 'LendSync');
      const loaded = (data.organization?.currency ?? 'USD').toUpperCase();
      const supported = currencyOptions.some((o) => o.code === loaded);
      setCurrency(supported ? loaded : 'USD');
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : 'Failed to load settings',
      );
      setOrgName('LendSync');
      setCurrency('USD');
    } finally {
      setGeneralLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveGeneral() {
    if (!orgName.trim()) {
      setGeneralError('Organization name is required');
      return;
    }
    const nextCurrency = (currency.trim() || 'USD').toUpperCase();
    setGeneralSaving(true);
    setGeneralError('');
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          key: 'organization',
          value: {
            name: orgName.trim(),
            currency: nextCurrency,
          },
        }),
      });
      setCurrency(nextCurrency);
      broadcastCurrency(nextCurrency);
      toast.success('Settings saved');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save settings';
      setGeneralError(message);
      toast.error(message);
    } finally {
      setGeneralSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              tab === t
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-white/5',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' && (
        <Card>
          <CardHeader>
            <CardTitle>General settings</CardTitle>
          </CardHeader>
          <CardContent className="max-w-lg space-y-4">
            {generalLoading ? (
              <FormSkeleton fields={2} />
            ) : (
              <>
                {generalError && (
                  <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
                    {generalError}
                  </p>
                )}
                <Field label="Organization name">
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </Field>
                <Field label="Currency">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="field-control w-full"
                  >
                    {currencyOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button onClick={() => void saveGeneral()} disabled={generalSaving}>
                  {generalSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'Loan Products' && <LoanProductsTab />}

      {tab === 'Users & Roles' && <UsersRolesTab />}

      {tab === 'Integrations' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { name: 'Stripe', status: 'Connected', desc: 'Payments & disbursements' },
            { name: 'Twilio', status: 'Not connected', desc: 'SMS notifications' },
            { name: 'Experian', status: 'Not connected', desc: 'Credit scoring API' },
            { name: 'DocuSign', status: 'Not connected', desc: 'E-signature workflows' },
          ].map((item) => (
            <Card key={item.name}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="font-display font-semibold">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                  <div className="mt-2 text-xs text-primary">{item.status}</div>
                </div>
                <Button variant="secondary" size="sm">
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'Security' && (
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <Toggle
              label="Require 2FA for staff"
              checked={require2fa}
              onChange={setRequire2fa}
            />
            <Toggle
              label="Enforce TLS"
              checked={enforceTls}
              onChange={setEnforceTls}
            />
            <Toggle
              label="Automatic backups"
              checked={autoBackups}
              onChange={setAutoBackups}
            />
            <Button onClick={() => toast.success('Security settings updated')}>
              Save security settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type LoanProduct = {
  id: string;
  name: string;
  description: string | null;
  loan_type: string;
  interest_method: string;
  annual_rate_percent: string | number;
  min_amount_cents: string | number;
  max_amount_cents: string | number;
  min_tenure_months: number;
  max_tenure_months: number;
  grace_days: number;
  is_active: boolean;
};

const loanTypeOptions = [
  { value: 'business', label: 'Business' },
  { value: 'personal', label: 'Personal' },
  { value: 'home_equity', label: 'Home Equity' },
  { value: 'auto', label: 'Auto' },
  { value: 'micro', label: 'Micro' },
] as const;

const interestMethodOptions = [
  { value: 'reducing', label: 'Reducing balance' },
  { value: 'flat', label: 'Flat rate' },
] as const;

const loanTypeLabel: Record<string, string> = Object.fromEntries(
  loanTypeOptions.map((o) => [o.value, o.label]),
);

type ProductFormState = {
  name: string;
  description: string;
  loanType: string;
  interestMethod: string;
  annualRatePercent: string;
  minAmount: string;
  maxAmount: string;
  minTenureMonths: string;
  maxTenureMonths: string;
  graceDays: string;
  isActive: boolean;
};

const emptyProductForm = (): ProductFormState => ({
  name: '',
  description: '',
  loanType: 'personal',
  interestMethod: 'reducing',
  annualRatePercent: '12',
  minAmount: '1000',
  maxAmount: '100000',
  minTenureMonths: '6',
  maxTenureMonths: '36',
  graceDays: '0',
  isActive: true,
});

function productToForm(p: LoanProduct): ProductFormState {
  return {
    name: p.name,
    description: p.description ?? '',
    loanType: p.loan_type,
    interestMethod: p.interest_method,
    annualRatePercent: String(Number(p.annual_rate_percent)),
    minAmount: String(Number(p.min_amount_cents) / 100),
    maxAmount: String(Number(p.max_amount_cents) / 100),
    minTenureMonths: String(p.min_tenure_months),
    maxTenureMonths: String(p.max_tenure_months),
    graceDays: String(p.grace_days),
    isActive: p.is_active,
  };
}

function LoanProductsTab() {
  const currency = useCurrency();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LoanProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProducts(await api<LoanProduct[]>('/admin/loan-products'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyProductForm());
    setEditorOpen(true);
  }

  function openEdit(product: LoanProduct) {
    setEditing(product);
    setForm(productToForm(product));
    setEditorOpen(true);
  }

  function updateForm<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProduct() {
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    const minAmountCents = Math.round(Number(form.minAmount) * 100);
    const maxAmountCents = Math.round(Number(form.maxAmount) * 100);
    const minTenureMonths = Number(form.minTenureMonths);
    const maxTenureMonths = Number(form.maxTenureMonths);
    const annualRatePercent = Number(form.annualRatePercent);
    const graceDays = Number(form.graceDays);

    if (
      ![minAmountCents, maxAmountCents, minTenureMonths, maxTenureMonths].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      !Number.isFinite(annualRatePercent) ||
      annualRatePercent < 0 ||
      !Number.isFinite(graceDays) ||
      graceDays < 0
    ) {
      toast.error('Check amount, rate, and tenure values');
      return;
    }
    if (minAmountCents > maxAmountCents) {
      toast.error('Min amount cannot exceed max amount');
      return;
    }
    if (minTenureMonths > maxTenureMonths) {
      toast.error('Min tenure cannot exceed max tenure');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      loanType: form.loanType,
      interestMethod: form.interestMethod,
      annualRatePercent,
      minAmountCents,
      maxAmountCents,
      minTenureMonths,
      maxTenureMonths,
      graceDays,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        await api(`/admin/loan-products/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Product updated');
      } else {
        await api('/admin/loan-products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Product created');
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: LoanProduct) {
    setBusyId(product.id);
    try {
      await api(`/admin/loan-products/${product.id}/active`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !product.is_active }),
      });
      toast.success(
        product.is_active ? 'Product deactivated' : 'Product activated',
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function removeProduct(product: LoanProduct) {
    if (
      !window.confirm(
        `Delete "${product.name}"? This only works if no applications or loans use it.`,
      )
    ) {
      return;
    }
    setBusyId(product.id);
    try {
      await api(`/admin/loan-products/${product.id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Loan products</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Catalogue for this workspace. Inactive products stay on existing
              loans but are hidden from new applications.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            New product
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
              {error}
            </p>
          )}

          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Rate</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Tenure</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5">
                        {loanTypeLabel[p.loan_type] ?? p.loan_type}
                      </td>
                      <td className="py-2.5 font-mono text-xs">
                        {Number(p.annual_rate_percent)}%{' '}
                        <span className="text-muted-foreground">
                          {p.interest_method === 'flat' ? 'flat' : 'reducing'}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        <Money cents={Number(p.min_amount_cents)} />
                        {' – '}
                        <Money cents={Number(p.max_amount_cents)} />
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {p.min_tenure_months}–{p.max_tenure_months} mo
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            p.is_active
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit product"
                            disabled={busyId === p.id}
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === p.id}
                            onClick={() => void toggleActive(p)}
                          >
                            {p.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete product"
                            disabled={busyId === p.id}
                            onClick={() => void removeProduct(p)}
                          >
                            <Trash2 className="h-4 w-4 text-chart-red" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No products yet. Create one to start accepting
                        applications.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">
                {editing ? 'Edit product' : 'New product'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setEditorOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="e.g. Personal Flex"
                />
              </Field>
              <Field label="Description">
                <Input
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Optional short description"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Loan type">
                  <select
                    className="field-control w-full"
                    value={form.loanType}
                    onChange={(e) => updateForm('loanType', e.target.value)}
                  >
                    {loanTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Interest method">
                  <select
                    className="field-control w-full"
                    value={form.interestMethod}
                    onChange={(e) =>
                      updateForm('interestMethod', e.target.value)
                    }
                  >
                    {interestMethodOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Annual rate (%)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.annualRatePercent}
                    onChange={(e) =>
                      updateForm('annualRatePercent', e.target.value)
                    }
                  />
                </Field>
                <Field label="Grace days">
                  <Input
                    type="number"
                    min="0"
                    value={form.graceDays}
                    onChange={(e) => updateForm('graceDays', e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Min amount (${currency})`}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minAmount}
                    onChange={(e) => updateForm('minAmount', e.target.value)}
                  />
                </Field>
                <Field label={`Max amount (${currency})`}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.maxAmount}
                    onChange={(e) => updateForm('maxAmount', e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Min tenure (months)">
                  <Input
                    type="number"
                    min="1"
                    value={form.minTenureMonths}
                    onChange={(e) =>
                      updateForm('minTenureMonths', e.target.value)
                    }
                  />
                </Field>
                <Field label="Max tenure (months)">
                  <Input
                    type="number"
                    min="1"
                    value={form.maxTenureMonths}
                    onChange={(e) =>
                      updateForm('maxTenureMonths', e.target.value)
                    }
                  />
                </Field>
              </div>
              <Toggle
                label="Active (visible for new applications)"
                checked={form.isActive}
                onChange={(v) => updateForm('isActive', v)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={() => void saveProduct()} disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : editing
                      ? 'Save changes'
                      : 'Create product'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'loan_officer' | 'borrower';
  kyc_status?: string;
  created_at: string;
};

const roleOptions = [
  { value: 'loan_officer', label: 'Loan Officer' },
  { value: 'admin', label: 'Administrator' },
] as const;

const roleLabel: Record<string, string> = {
  admin: 'Administrator',
  loan_officer: 'Loan Officer',
  borrower: 'Borrower',
};

function UsersRolesTab() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'loan_officer'>('loan_officer');
  const [inviting, setInviting] = useState(false);
  const [tempCredential, setTempCredential] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await api<StaffUser[]>('/admin/users'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite() {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setInviting(true);
    setTempCredential(null);
    try {
      const res = await api<{ email: string; tempPassword: string }>(
        '/admin/users/invite',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            fullName: name.trim(),
            role,
          }),
        },
      );
      setTempCredential({ email: res.email, tempPassword: res.tempPassword });
      toast.success(`Invited ${res.email}`);
      setName('');
      setEmail('');
      setRole('loan_officer');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="field-control w-full"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as 'admin' | 'loan_officer')
            }
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button onClick={() => void invite()} disabled={inviting}>
            {inviting ? 'Inviting…' : 'Invite user'}
          </Button>
        </div>

        {tempCredential && (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <span className="font-semibold">{tempCredential.email}</span> can
            sign in with temporary password{' '}
            <code className="rounded bg-black/20 px-1.5 py-0.5 font-mono">
              {tempCredential.tempPassword}
            </code>
            . Share it securely — it won&apos;t be shown again.
          </div>
        )}

        {error && (
          <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
            {error}
          </p>
        )}

        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => u.role !== 'borrower')
                .map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-2">{u.full_name}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{roleLabel[u.role] ?? u.role}</td>
                    <td className="py-2 text-muted-foreground">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              {users.filter((u) => u.role !== 'borrower').length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No team members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-border px-3 py-3 text-sm"
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
