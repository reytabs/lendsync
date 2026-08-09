'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { FormSkeleton, TableSkeleton } from '@/components/skeletons';
import { broadcastCurrency } from '@/lib/currency';
import { cn, formatDate } from '@/lib/utils';

const tabs = ['General', 'Users & Roles', 'Integrations', 'Security'] as const;

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
