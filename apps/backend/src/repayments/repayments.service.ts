import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { TenantContext } from '../database/tenant-context';
import type { AuthUser } from '../auth/auth.guards';
import { NotificationsService } from '../notifications/notifications.service';

function moneyLabel(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly tenant: TenantContext,
  ) {}

  async listDue(user: AuthUser) {
    const params: unknown[] = [];
    let borrowerClause = '';
    if (user.role === 'borrower') {
      params.push(user.id);
      borrowerClause = `and l.borrower_id = $${params.length}`;
    }

    return this.db.many(
      `select l.id,
              l.application_id,
              l.principal_cents,
              l.tenure_months,
              l.annual_rate_percent,
              l.loan_type,
              l.status,
              l.disbursed_at,
              l.created_at,
              jsonb_build_object(
                'full_name', b.full_name,
                'email', b.email
              ) as borrower,
              (
                select jsonb_build_object(
                  'id', s.id,
                  'installment_no', s.installment_no,
                  'due_date', s.due_date,
                  'total_cents', s.total_cents,
                  'principal_cents', s.principal_cents,
                  'interest_cents', s.interest_cents,
                  'status', s.status,
                  'paid_cents', coalesce((
                    select sum(r.amount_cents)::bigint
                    from repayments r
                    where r.schedule_id = s.id
                  ), 0),
                  'remaining_cents', greatest(
                    s.total_cents - coalesce((
                      select sum(r.amount_cents)::bigint
                      from repayments r
                      where r.schedule_id = s.id
                    ), 0),
                    0
                  )
                )
                from repayment_schedules s
                where s.loan_id = l.id
                  and s.status = any(
                    array['upcoming','overdue','partial']::public.schedule_status[]
                  )
                order by s.installment_no
                limit 1
              ) as next_installment,
              (
                select count(*)::int
                from repayment_schedules s
                where s.loan_id = l.id and s.status <> 'paid'
              ) as unpaid_count
       from loans l
       join profiles b on b.id = l.borrower_id
       where l.status = any(
         array['approved','disbursed','active']::public.loan_status[]
       )
       ${borrowerClause}
       order by
         case when l.status = 'approved' then 0 else 1 end,
         l.created_at desc`,
      params,
    );
  }

  async create(
    user: AuthUser,
    dto: {
      loanId: string;
      amountCents: number;
      scheduleId?: string;
      stripePaymentIntentId?: string;
    },
  ) {
    const loan = await this.db.one('select * from loans where id = $1', [
      dto.loanId,
    ]);
    if (!loan) throw new BadRequestException('Loan not found');
    if (user.role === 'borrower' && loan.borrower_id !== user.id) {
      throw new BadRequestException('Not your loan');
    }
    if (!['approved', 'disbursed', 'active'].includes(loan.status)) {
      throw new BadRequestException(
        `Cannot record payment for loan status "${loan.status}"`,
      );
    }

    let scheduleId = dto.scheduleId;
    let schedule =
      scheduleId != null
        ? await this.db.one(
            `select * from repayment_schedules where id = $1 and loan_id = $2`,
            [scheduleId, dto.loanId],
          )
        : null;

    if (scheduleId && !schedule) {
      throw new BadRequestException('Installment not found for this loan');
    }

    if (!schedule) {
      schedule = await this.db.one(
        `select * from repayment_schedules
         where loan_id = $1 and status = any(array['upcoming','overdue','partial']::public.schedule_status[])
         order by installment_no
         limit 1`,
        [dto.loanId],
      );
      scheduleId = schedule?.id;
    }

    if (!schedule || !scheduleId) {
      throw new BadRequestException('No unpaid installment on this loan');
    }

    if (['paid'].includes(schedule.status)) {
      throw new BadRequestException('Installment is already paid');
    }

    const alreadyPaid = await this.db.one<{ paid: string }>(
      `select coalesce(sum(amount_cents), 0)::text as paid
       from repayments where schedule_id = $1`,
      [scheduleId],
    );
    const paidSoFar = Number(alreadyPaid?.paid ?? 0);
    const remaining = Math.max(0, Number(schedule.total_cents) - paidSoFar);
    if (remaining <= 0) {
      await this.db.query(
        `update repayment_schedules set status = 'paid' where id = $1`,
        [scheduleId],
      );
      throw new BadRequestException('Installment is already fully paid');
    }
    if (dto.amountCents > remaining) {
      throw new BadRequestException(
        `Amount exceeds remaining balance of ${(remaining / 100).toFixed(2)}`,
      );
    }

    const newPaidTotal = paidSoFar + dto.amountCents;
    const newStatus =
      newPaidTotal >= Number(schedule.total_cents) ? 'paid' : 'partial';
    await this.db.query(
      `update repayment_schedules set status = $2::public.schedule_status where id = $1`,
      [scheduleId, newStatus],
    );

    const data = await this.db.one(
      `insert into repayments (
         loan_id, schedule_id, amount_cents, stripe_payment_intent_id, recorded_by
       ) values ($1, $2, $3, $4, $5)
       returning *`,
      [
        dto.loanId,
        scheduleId ?? null,
        dto.amountCents,
        dto.stripePaymentIntentId ?? null,
        user.id,
      ],
    );
    if (!data) throw new BadRequestException('Failed to record repayment');

    const unpaid = await this.db.one<{ count: string }>(
      `select count(*)::text as count from repayment_schedules
       where loan_id = $1 and status <> 'paid'`,
      [dto.loanId],
    );
    if (Number(unpaid?.count ?? 1) === 0) {
      await this.db.query(
        `update loans set status = 'completed', updated_at = now() where id = $1`,
        [dto.loanId],
      );
    }

    const borrower = await this.db.one<{ full_name: string }>(
      'select full_name from profiles where id = $1',
      [loan.borrower_id],
    );
    const amount = moneyLabel(dto.amountCents);
    const appHrefBorrower = loan.application_id
      ? `/portal/loans/${loan.application_id}`
      : '/portal/loans';
    await this.notifications.notifyUser(loan.borrower_id, {
      kind: 'payment_recorded',
      title: 'Payment recorded',
      body: `${amount} was applied to installment #${schedule.installment_no}.`,
      href: appHrefBorrower,
      entityType: 'repayment',
      entityId: data.id,
    });
    await this.notifications.notifyStaff({
      kind: 'payment_recorded',
      title: 'Payment received',
      body: `${borrower?.full_name ?? 'Borrower'} paid ${amount} (EMI #${schedule.installment_no}).`,
      href: '/repayments',
      entityType: 'repayment',
      entityId: data.id,
    });

    return data;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue() {
    // Cross-tenant job: run the sweep unscoped (owner role), then emit each
    // org's notifications inside that org's tenant scope so RLS/org defaults
    // apply correctly.
    const newlyOverdue = await this.db.manyUnscoped<{
      id: string;
      loan_id: string;
      installment_no: number;
      total_cents: string | number;
      borrower_id: string;
      application_id: string;
      full_name: string;
      organization_id: string;
    }>(
      `update repayment_schedules s
       set status = 'overdue'
       from loans l
       join profiles b on b.id = l.borrower_id
       join loan_products p on p.id = l.product_id
       where s.loan_id = l.id
         and s.status = 'upcoming'
         and (s.due_date + coalesce(p.grace_days, 0)) < current_date
       returning s.id, s.loan_id, s.installment_no, s.total_cents,
                 l.borrower_id, l.application_id, b.full_name,
                 l.organization_id`,
    );

    for (const row of newlyOverdue) {
      const amount = moneyLabel(Number(row.total_cents));
      await this.tenant.run(row.organization_id, async () => {
        await this.notifications.notifyUserOnceToday(row.borrower_id, {
          kind: 'emi_overdue',
          title: 'EMI overdue',
          body: `Installment #${row.installment_no} (${amount}) is overdue.`,
          href: `/portal/loans/${row.application_id}`,
          entityType: 'repayment_schedule',
          entityId: row.id,
        });
        await this.notifications.notifyStaff({
          kind: 'emi_overdue',
          title: 'Overdue installment',
          body: `${row.full_name}: EMI #${row.installment_no} (${amount}) overdue.`,
          href: '/collections',
          entityType: 'repayment_schedule',
          entityId: row.id,
        });
      });
    }
  }
}
