'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { FormSkeleton } from '@/components/skeletons';
import { broadcastCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
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

      {tab === 'Users & Roles' && (
        <Card>
          <CardHeader>
            <CardTitle>Users & Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
              <Input
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button
                onClick={() => {
                  toast.success(`Invite queued for ${inviteEmail || 'user'}`);
                  setInviteEmail('');
                  setInviteName('');
                }}
              >
                Invite user
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Admin User', 'admin@lendsync.local', 'admin', 'Active'],
                  ['James Reyes', 'james@lendsync.local', 'loan_officer', 'Active'],
                  ['Elena Cruz', 'elena@lendsync.local', 'loan_officer', 'Active'],
                ].map((row) => (
                  <tr key={row[1]} className="border-b border-border/50">
                    {row.map((cell) => (
                      <td key={cell} className="py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
