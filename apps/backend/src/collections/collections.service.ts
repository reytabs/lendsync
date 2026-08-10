import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

@Injectable()
export class CollectionsService {
  constructor(private readonly db: DatabaseService) {}

  async listQueue(user: AuthUser) {
    const collectorOnly = user.role === 'collector';
    return this.db.many(
      `select s.id as schedule_id,
              s.loan_id,
              s.installment_no,
              s.due_date,
              s.status,
              s.total_cents,
              s.promise_to_pay_date,
              s.collector_id,
              coalesce((
                select sum(r.amount_cents) from repayments r where r.schedule_id = s.id
              ), 0) as paid_cents,
              greatest(
                0,
                s.total_cents - coalesce((
                  select sum(r.amount_cents) from repayments r where r.schedule_id = s.id
                ), 0)
              ) as remaining_cents,
              (current_date - s.due_date) as days_past_due,
              l.application_id,
              l.loan_type,
              b.id as borrower_id,
              b.full_name as borrower_name,
              b.email as borrower_email,
              b.phone as borrower_phone,
              c.full_name as collector_name,
              (
                select n.note from collection_notes n
                where n.schedule_id = s.id
                order by n.created_at desc
                limit 1
              ) as last_note
       from repayment_schedules s
       join loans l on l.id = s.loan_id
       join profiles b on b.id = l.borrower_id
       left join profiles c on c.id = s.collector_id
       where s.status in ('overdue', 'partial')
         and ($1::boolean = false or s.collector_id = $2 or s.collector_id is null)
       order by s.due_date asc, s.installment_no asc`,
      [collectorOnly, user.id],
    );
  }

  async listCollectors() {
    return this.db.many(
      `select id, full_name, email, role
       from profiles
       where role in ('collector', 'loan_officer', 'admin')
       order by full_name`,
    );
  }

  async assignCollector(
    actor: AuthUser,
    scheduleId: string,
    collectorId: string | null,
  ) {
    if (collectorId) {
      const collector = await this.db.one<{ id: string }>(
        `select id from profiles
         where id = $1 and role in ('collector', 'loan_officer', 'admin')`,
        [collectorId],
      );
      if (!collector) throw new BadRequestException('Invalid collector');
    }

    const row = await this.db.one(
      `update repayment_schedules
       set collector_id = $2
       where id = $1
       returning id, loan_id, collector_id, promise_to_pay_date`,
      [scheduleId, collectorId],
    );
    if (!row) throw new NotFoundException('Schedule not found');

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'collection_assign', 'repayment_schedule', $2, $3::jsonb)`,
      [
        actor.id,
        scheduleId,
        JSON.stringify({ collectorId }),
      ],
    );
    return row;
  }

  async setPromiseToPay(
    actor: AuthUser,
    scheduleId: string,
    promiseToPayDate: string | null,
  ) {
    const row = await this.db.one(
      `update repayment_schedules
       set promise_to_pay_date = $2::date
       where id = $1
       returning id, loan_id, collector_id, promise_to_pay_date`,
      [scheduleId, promiseToPayDate],
    );
    if (!row) throw new NotFoundException('Schedule not found');

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'collection_ptp', 'repayment_schedule', $2, $3::jsonb)`,
      [
        actor.id,
        scheduleId,
        JSON.stringify({ promiseToPayDate }),
      ],
    );
    return row;
  }

  async addNote(
    actor: AuthUser,
    dto: {
      scheduleId: string;
      note: string;
      channel?: string;
      promiseToPayDate?: string;
    },
  ) {
    const note = dto.note?.trim();
    if (!note) throw new BadRequestException('Note is required');
    const channel = dto.channel ?? 'other';
    if (!['call', 'sms', 'email', 'visit', 'other'].includes(channel)) {
      throw new BadRequestException('Invalid channel');
    }

    const schedule = await this.db.one<{
      id: string;
      loan_id: string;
    }>('select id, loan_id from repayment_schedules where id = $1', [
      dto.scheduleId,
    ]);
    if (!schedule) throw new NotFoundException('Schedule not found');

    if (dto.promiseToPayDate) {
      await this.db.query(
        `update repayment_schedules
         set promise_to_pay_date = $2::date
         where id = $1`,
        [dto.scheduleId, dto.promiseToPayDate],
      );
    }

    const created = await this.db.one(
      `insert into collection_notes (
         loan_id, schedule_id, author_id, channel, note, promise_to_pay_date
       ) values ($1, $2, $3, $4, $5, $6::date)
       returning *`,
      [
        schedule.loan_id,
        dto.scheduleId,
        actor.id,
        channel,
        note,
        dto.promiseToPayDate ?? null,
      ],
    );

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'collection_note', 'repayment_schedule', $2, $3::jsonb)`,
      [
        actor.id,
        dto.scheduleId,
        JSON.stringify({ channel, note: note.slice(0, 200) }),
      ],
    );

    return created;
  }

  async listNotes(scheduleId: string) {
    return this.db.many(
      `select n.*, p.full_name as author_name
       from collection_notes n
       left join profiles p on p.id = n.author_id
       where n.schedule_id = $1
       order by n.created_at desc`,
      [scheduleId],
    );
  }
}
