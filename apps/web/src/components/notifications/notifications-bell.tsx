'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function relativeTime(value: string) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await api<{ count: number }>('/notifications/unread-count');
      setUnread(res.count);
    } catch {
      // ignore while logged out / booting
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<NotificationItem[]>('/notifications?limit=30');
      setItems(rows);
      setUnread(rows.filter((r) => !r.read_at).length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('lms_token')
        : null;
    if (!token) return;

    const url = `${API_URL}/api/notifications/stream?access_token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type?: string;
          notification?: NotificationItem;
        };
        if (data.type === 'heartbeat') return;
        if (data.type === 'notification' && data.notification) {
          const n = data.notification;
          setItems((prev) => {
            if (prev.some((p) => p.id === n.id)) return prev;
            return [n, ...prev].slice(0, 30);
          });
          if (!n.read_at) setUnread((c) => c + 1);
        }
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      // EventSource reconnects automatically; refresh count after blip
      void refreshUnread();
    };

    return () => es.close();
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function onOpenItem(item: NotificationItem) {
    if (!item.read_at) {
      try {
        await api(`/notifications/${item.id}/read`, { method: 'POST' });
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, read_at: new Date().toISOString() } : p,
          ),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // still navigate
      }
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  async function onMarkAll() {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setItems((prev) =>
        prev.map((p) => ({
          ...p,
          read_at: p.read_at ?? new Date().toISOString(),
        })),
      );
      setUnread(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border bg-[#12141a] shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:opacity-40"
              disabled={unread === 0}
              onClick={() => void onMarkAll()}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void onOpenItem(item)}
                      className={cn(
                        'w-full border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-white/5',
                        !item.read_at && 'bg-primary/5',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {item.body}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
