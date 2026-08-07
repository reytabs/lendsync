import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

export type NotificationKind =
  | 'loan_submitted'
  | 'loan_approved'
  | 'loan_rejected'
  | 'loan_disbursed'
  | 'payment_recorded'
  | 'emi_overdue'
  | 'emi_due_soon';

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type CreateNotificationInput = {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  entityType?: string;
  entityId?: string;
};

type FanoutEvent = {
  userId: string;
  notification: NotificationRow;
};

@Injectable()
export class NotificationsService {
  private readonly fanout$ = new Subject<FanoutEvent>();

  constructor(private readonly db: DatabaseService) {}

  stream(userId: string): Observable<MessageEvent> {
    return this.fanout$.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({
        data: {
          type: 'notification',
          notification: e.notification,
        },
      })),
    );
  }

  async list(user: AuthUser, limit = 30) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.db.many<NotificationRow>(
      `select * from notifications
       where user_id = $1
       order by created_at desc
       limit $2`,
      [user.id, safeLimit],
    );
  }

  async unreadCount(user: AuthUser) {
    const row = await this.db.one<{ count: string }>(
      `select count(*)::text as count
       from notifications
       where user_id = $1 and read_at is null`,
      [user.id],
    );
    return { count: Number(row?.count ?? 0) };
  }

  async markRead(user: AuthUser, id: string) {
    const row = await this.db.one<NotificationRow>(
      `update notifications
       set read_at = coalesce(read_at, now())
       where id = $1 and user_id = $2
       returning *`,
      [id, user.id],
    );
    return row;
  }

  async markAllRead(user: AuthUser) {
    await this.db.query(
      `update notifications
       set read_at = now()
       where user_id = $1 and read_at is null`,
      [user.id],
    );
    return { ok: true };
  }

  async notifyUser(userId: string, input: CreateNotificationInput) {
    const row = await this.db.one<NotificationRow>(
      `insert into notifications (
         user_id, kind, title, body, href, entity_type, entity_id
       ) values ($1, $2::public.notification_kind, $3, $4, $5, $6, $7)
       returning *`,
      [
        userId,
        input.kind,
        input.title,
        input.body,
        input.href ?? null,
        input.entityType ?? null,
        input.entityId ?? null,
      ],
    );
    if (row) {
      this.fanout$.next({ userId, notification: row });
    }
    return row;
  }

  async notifyStaff(input: CreateNotificationInput) {
    const staff = await this.db.many<{ id: string }>(
      `select id from profiles
       where role in ('admin', 'loan_officer')`,
    );
    const rows: NotificationRow[] = [];
    for (const s of staff) {
      const row = await this.notifyUser(s.id, input);
      if (row) rows.push(row);
    }
    return rows;
  }

  /** Skip if same kind+entity already notified for this user today. */
  async notifyUserOnceToday(
    userId: string,
    input: CreateNotificationInput & { entityId: string },
  ) {
    const existing = await this.db.one(
      `select id from notifications
       where user_id = $1
         and kind = $2::public.notification_kind
         and entity_id = $3
         and created_at::date = current_date
       limit 1`,
      [userId, input.kind, input.entityId],
    );
    if (existing) return null;
    return this.notifyUser(userId, input);
  }
}
