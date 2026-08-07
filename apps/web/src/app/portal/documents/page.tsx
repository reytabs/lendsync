'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';

type Doc = {
  id: string;
  doc_type: string;
  storage_path: string;
  status: string;
  created_at: string;
  notes?: string | null;
};

const DOC_TYPES = [
  { value: 'government_id', label: 'Government ID' },
  { value: 'proof_of_income', label: 'Proof of income' },
  { value: 'collateral', label: 'Collateral' },
  { value: 'other', label: 'Other' },
];

export default function PortalDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState('government_id');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setDocs(await api<Doc[]>('/documents'));
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load'),
    );
  }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileName.trim()) {
      setError('Choose a file');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api('/documents', {
        method: 'POST',
        body: JSON.stringify({
          docType,
          storagePath: `uploads/${Date.now()}_${fileName.trim()}`,
        }),
      });
      setFileName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Type</span>
              <select
                className="flex h-10 rounded-md border border-border bg-black/30 px-3 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[200px] flex-1 space-y-1.5 text-sm">
              <span className="text-muted-foreground">File</span>
              <Input
                type="file"
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? '')
                }
              />
            </label>
            <Button type="submit" disabled={saving || !fileName}>
              {saving ? 'Saving…' : 'Register upload'}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            MVP stores the filename as a document reference (no cloud storage).
          </p>
          {error && <p className="mt-2 text-sm text-chart-red">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">File</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-3 capitalize">
                      {d.doc_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {d.storage_path.split('/').pop()}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
