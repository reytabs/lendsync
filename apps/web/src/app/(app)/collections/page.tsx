'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Money } from '@/components/money';
import { TableSkeleton } from '@/components/skeletons';
import { getStoredAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

type QueueItem = {
  schedule_id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  status: string;
  total_cents: string | number;
  paid_cents: string | number;
  remaining_cents: string | number;
  days_past_due: number;
  promise_to_pay_date: string | null;
  collector_id: string | null;
  collector_name: string | null;
  borrower_name: string;
  borrower_email: string;
  borrower_phone: string | null;
  last_note: string | null;
  application_id: string;
};

type Collector = { id: string; full_name: string; email: string; role: string };

type Note = {
  id: string;
  note: string;
  channel: string;
  created_at: string;
  author_name: string | null;
  promise_to_pay_date: string | null;
};

export default function CollectionsPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [channel, setChannel] = useState('call');
  const [ptp, setPtp] = useState('');
  const [saving, setSaving] = useState(false);
  const canWrite = useMemo(() => {
    const role = getStoredAuth()?.role;
    return role !== 'viewer';
  }, []);

  const selected = queue.find((q) => q.schedule_id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [q, c] = await Promise.all([
        api<QueueItem[]>('/collections/queue'),
        api<Collector[]>('/collections/collectors').catch(() => [] as Collector[]),
      ]);
      setQueue(q);
      setCollectors(c);
      setSelectedId((prev) => prev ?? q[0]?.schedule_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotes = useCallback(async (scheduleId: string) => {
    try {
      setNotes(await api<Note[]>(`/collections/notes/${scheduleId}`));
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) {
      void loadNotes(selectedId);
      const item = queue.find((q) => q.schedule_id === selectedId);
      setPtp(item?.promise_to_pay_date?.slice(0, 10) ?? '');
    }
  }, [selectedId, loadNotes, queue]);

  async function assign(collectorId: string) {
    if (!selectedId || !canWrite) return;
    setSaving(true);
    try {
      await api(`/collections/${selectedId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
          collectorId: collectorId || null,
        }),
      });
      toast.success('Collector updated');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setSaving(false);
    }
  }

  async function savePtp() {
    if (!selectedId || !canWrite) return;
    setSaving(true);
    try {
      await api(`/collections/${selectedId}/promise`, {
        method: 'PATCH',
        body: JSON.stringify({ promiseToPayDate: ptp || null }),
      });
      toast.success('Promise-to-pay saved');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!selectedId || !noteText.trim() || !canWrite) return;
    setSaving(true);
    try {
      await api('/collections/notes', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: selectedId,
          note: noteText.trim(),
          channel,
          promiseToPayDate: ptp || undefined,
        }),
      });
      setNoteText('');
      toast.success('Note added');
      await Promise.all([load(), loadNotes(selectedId)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Note failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <TableSkeleton rows={8} cols={6} />;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md border border-chart-red/40 bg-chart-red/10 px-3 py-2 text-sm text-chart-red">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Overdue queue</CardTitle>
            <p className="text-xs text-muted-foreground">
              Installments past due — assign collectors, set PTP, log outreach
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Borrower</th>
                  <th className="pb-2">Due</th>
                  <th className="pb-2">DPD</th>
                  <th className="pb-2">Remaining</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Collector</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr
                    key={row.schedule_id}
                    className={`cursor-pointer border-b border-border/50 ${
                      selectedId === row.schedule_id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => setSelectedId(row.schedule_id)}
                  >
                    <td className="py-2">
                      <div className="font-medium">{row.borrower_name}</div>
                      <div className="text-xs text-muted-foreground">
                        EMI #{row.installment_no}
                      </div>
                    </td>
                    <td className="py-2">{formatDate(row.due_date)}</td>
                    <td className="py-2">{row.days_past_due}</td>
                    <td className="py-2">
                      <Money cents={Number(row.remaining_cents)} />
                    </td>
                    <td className="py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {row.collector_name ?? '—'}
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No overdue installments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Select an installment from the queue.
              </p>
            ) : (
              <>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{selected.borrower_name}</p>
                  <p className="text-muted-foreground">
                    {selected.borrower_email}
                    {selected.borrower_phone
                      ? ` · ${selected.borrower_phone}`
                      : ''}
                  </p>
                  <p className="text-muted-foreground">
                    Due {formatDate(selected.due_date)} ·{' '}
                    <Money cents={Number(selected.remaining_cents)} /> remaining
                  </p>
                  {selected.last_note && (
                    <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                      Last note: {selected.last_note}
                    </p>
                  )}
                </div>

                {canWrite && (
                  <>
                    <label className="block space-y-1.5 text-sm">
                      <span className="text-muted-foreground">Assign collector</span>
                      <select
                        className="field-control w-full"
                        value={selected.collector_id ?? ''}
                        disabled={saving}
                        onChange={(e) => void assign(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {collectors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.role})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex gap-2">
                      <label className="block flex-1 space-y-1.5 text-sm">
                        <span className="text-muted-foreground">
                          Promise to pay
                        </span>
                        <Input
                          type="date"
                          value={ptp}
                          onChange={(e) => setPtp(e.target.value)}
                        />
                      </label>
                      <Button
                        className="mt-6"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => void savePtp()}
                      >
                        Save
                      </Button>
                    </div>

                    <label className="block space-y-1.5 text-sm">
                      <span className="text-muted-foreground">Channel</span>
                      <select
                        className="field-control w-full"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                      >
                        {['call', 'sms', 'email', 'visit', 'other'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1.5 text-sm">
                      <span className="text-muted-foreground">Add note</span>
                      <textarea
                        className="field-control min-h-[80px] w-full"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Outcome of outreach…"
                      />
                    </label>
                    <Button
                      disabled={saving || !noteText.trim()}
                      onClick={() => void addNote()}
                    >
                      Log note
                    </Button>
                  </>
                )}

                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Activity
                  </p>
                  {notes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                  )}
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {n.channel} · {n.author_name ?? 'Staff'}
                        </span>
                        <span>{formatDate(n.created_at)}</span>
                      </div>
                      <p className="mt-1">{n.note}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
