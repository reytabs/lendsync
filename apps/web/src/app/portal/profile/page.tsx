'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  occupation?: string | null;
  credit_score?: number | null;
  kyc_status?: string;
};

export default function PortalProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Profile>('/me').then((p) => {
      setProfile(p);
      setFullName(p.full_name ?? '');
      setPhone(p.phone ?? '');
      setOccupation(p.occupation ?? '');
      if (p.full_name) localStorage.setItem('lms_full_name', p.full_name);
    });
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api<Profile>('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          occupation: occupation || undefined,
        }),
      });
      setProfile(updated);
      localStorage.setItem('lms_full_name', updated.full_name);
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-3">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input value={profile.email} disabled />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Full name</span>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Phone</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Occupation</span>
            <Input
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </label>
          {profile.credit_score != null && (
            <p className="text-xs text-muted-foreground">
              Credit score: {profile.credit_score} · KYC: {profile.kyc_status}
            </p>
          )}
          {error && <p className="text-sm text-chart-red">{error}</p>}
          {message && (
            <p className="text-sm text-[#4ADE80]">{message}</p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
