import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { calculateEmi } from '@lms/utils';
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

type ScheduleRow = {
  id: string;
  installment_no: number;
  due_date: string;
  principal_cents: string | number;
  interest_cents: string | number;
  total_cents: string | number;
  status: string;
  paid_cents: string | number;
};

function remainingBreakdown(schedule: ScheduleRow) {
  const principal = Number(schedule.principal_cents);
  const interest = Number(schedule.interest_cents);
  const total = Number(schedule.total_cents);
  const paid = Number(schedule.paid_cents ?? 0);
  const remainingTotal = Math.max(0, total - paid);
  // Payments apply to interest first, then principal
  const interestRemaining = Math.max(0, interest - Math.min(paid, interest));
  const principalPaid = Math.max(0, paid - interest);
  const principalRemaining = Math.max(0, principal - principalPaid);
  return { remainingTotal, principalRemaining, interestRemaining, paid };
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
              l.interest_method,
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

  private async loadUnpaidSchedules(loanId: string): Promise<ScheduleRow[]> {
    return this.db.many<ScheduleRow>(
      `select s.id,
              s.installment_no,
              s.due_date::text as due_date,
              s.principal_cents,
              s.interest_cents,
              s.total_cents,
              s.status,
              coalesce((
                select sum(r.amount_cents)::bigint
                from repayments r
                where r.schedule_id = s.id
              ), 0) as paid_cents
       from repayment_schedules s
       where s.loan_id = $1
         and s.status = any(array['upcoming','overdue','partial']::public.schedule_status[])
       order by s.installment_no`,
      [loanId],
    );
  }

  async payoffQuote(loanId: string, user: AuthUser) {
    const loan = await this.db.one('select * from loans where id = $1', [loanId]);
    if (!loan) throw new NotFoundException('Loan not found');
    if (user.role === 'borrower' && loan.borrower_id !== user.id) {
      throw new NotFoundException('Loan not found');
    }
    if (!['approved', 'disbursed', 'active'].includes(loan.status)) {
      throw new BadRequestException(
        `Cannot settle loan with status "${loan.status}"`,
      );
    }

    const unpaid = await this.loadUnpaidSchedules(loanId);
    let outstandingPrincipalCents = 0;
    let outstandingInterestCents = 0;
    let outstandingTotalCents = 0;
    for (const row of unpaid) {
      const br = remainingBreakdown(row);
      outstandingPrincipalCents += br.principalRemaining;
      outstandingInterestCents += br.interestRemaining;
      outstandingTotalCents += br.remainingTotal;
    }

    return {
      loanId,
      status: loan.status,
      tenureMonths: Number(loan.tenure_months),
      annualRatePercent: Number(loan.annual_rate_percent),
      interestMethod: loan.interest_method,
      unpaidInstallments: unpaid.length,
      outstandingPrincipalCents,
      outstandingInterestCents,
      outstandingTotalCents,
      payoffFullCents: outstandingTotalCents,
      payoffWaiveInterestCents: outstandingPrincipalCents,
    };
  }

  async earlySettle(
    user: AuthUser,
    loanId: string,
    dto: { waiveInterest?: boolean; notes?: string },
  ) {
    const quote = await this.payoffQuote(loanId, user);
    const waiveInterest = Boolean(dto.waiveInterest);
    const amountCents = waiveInterest
      ? quote.payoffWaiveInterestCents
      : quote.payoffFullCents;
    if (amountCents < 1) {
      throw new BadRequestException('Nothing outstanding on this loan');
    }

    const loan = await this.db.one('select * from loans where id = $1', [loanId]);
    if (!loan) throw new NotFoundException('Loan not found');

    const unpaid = await this.loadUnpaidSchedules(loanId);

    const repayment = await this.db.one(
      `insert into repayments (
         loan_id, schedule_id, amount_cents, recorded_by
       ) values ($1, null, $2, $3)
       returning *`,
      [loanId, amountCents, user.id],
    );
    if (!repayment) throw new BadRequestException('Failed to record settlement');

    for (const row of unpaid) {
      await this.db.query(
        `update repayment_schedules
         set status = 'paid'::public.schedule_status
         where id = $1`,
        [row.id],
      );
    }

    await this.db.query(
      `update loans set status = 'completed', updated_at = now() where id = $1`,
      [loanId],
    );

    const waived = waiveInterest ? quote.outstandingInterestCents : 0;
    await this.db.query(
      `insert into loan_restructures (
         loan_id, kind, actor_id, notes,
         before_tenure_months, after_tenure_months,
         before_annual_rate_percent, after_annual_rate_percent,
         outstanding_principal_cents, outstanding_interest_cents,
         settlement_amount_cents, waived_interest_cents, meta
       ) values (
         $1, 'early_settlement', $2, $3,
         $4, $4, $5, $5,
         $6, $7, $8, $9, $10::jsonb
       )`,
      [
        loanId,
        user.id,
        dto.notes?.trim() || null,
        Number(loan.tenure_months),
        Number(loan.annual_rate_percent),
        quote.outstandingPrincipalCents,
        quote.outstandingInterestCents,
        amountCents,
        waived,
        JSON.stringify({ waiveInterest, installmentIds: unpaid.map((u) => u.id) }),
      ],
    );

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'loan_early_settlement', 'loan', $2, $3::jsonb)`,
      [
        user.id,
        loanId,
        JSON.stringify({
          amountCents,
          waiveInterest,
          waivedInterestCents: waived,
          notes: dto.notes ?? null,
        }),
      ],
    );

    const amount = moneyLabel(amountCents);
    const appHref = loan.application_id
      ? `/portal/loans/${loan.application_id}`
      : '/portal/loans';
    await this.notifications.notifyUser(loan.borrower_id, {
      kind: 'payment_recorded',
      title: 'Loan settled early',
      body: `Your loan was closed with an early settlement of ${amount}${
        waiveInterest && waived > 0
          ? ` (interest waived: ${moneyLabel(waived)})`
          : ''
      }.`,
      href: appHref,
      entityType: 'loan',
      entityId: loanId,
    });
    await this.notifications.notifyStaff({
      kind: 'payment_recorded',
      title: 'Early settlement',
      body: `Loan ${loanId.slice(0, 8)} settled for ${amount}.`,
      href: '/repayments',
      entityType: 'loan',
      entityId: loanId,
    });

    return {
      repayment,
      quote,
      amountCents,
      waivedInterestCents: waived,
      status: 'completed',
    };
  }

  async restructure(
    user: AuthUser,
    loanId: string,
    dto: {
      kind: 'tenure_change' | 'payment_holiday' | 'rate_change';
      newTenureMonths?: number;
      newAnnualRatePercent?: number;
      holidayMonths?: number;
      notes?: string;
    },
  ) {
    const loan = await this.db.one('select * from loans where id = $1', [loanId]);
    if (!loan) throw new NotFoundException('Loan not found');
    if (!['approved', 'disbursed', 'active'].includes(loan.status)) {
      throw new BadRequestException(
        `Cannot restructure loan with status "${loan.status}"`,
      );
    }

    const unpaid = await this.loadUnpaidSchedules(loanId);
    if (!unpaid.length) {
      throw new BadRequestException('No unpaid installments to restructure');
    }

    if (dto.kind === 'payment_holiday') {
      const months = dto.holidayMonths ?? 0;
      if (!Number.isInteger(months) || months < 1 || months > 24) {
        throw new BadRequestException('holidayMonths must be between 1 and 24');
      }
      for (const row of unpaid) {
        await this.db.query(
          `update repayment_schedules
           set due_date = (due_date + ($2::text || ' months')::interval)::date
           where id = $1`,
          [row.id, String(months)],
        );
      }
      await this.db.query(
        `insert into loan_restructures (
           loan_id, kind, actor_id, notes, holiday_months,
           before_tenure_months, after_tenure_months,
           before_annual_rate_percent, after_annual_rate_percent, meta
         ) values ($1,'payment_holiday',$2,$3,$4,$5,$5,$6,$6,$7::jsonb)`,
        [
          loanId,
          user.id,
          dto.notes?.trim() || null,
          months,
          Number(loan.tenure_months),
          Number(loan.annual_rate_percent),
          JSON.stringify({ shiftedInstallments: unpaid.length }),
        ],
      );
      await this.db.query(
        `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
         values ($1, 'loan_payment_holiday', 'loan', $2, $3::jsonb)`,
        [
          user.id,
          loanId,
          JSON.stringify({ holidayMonths: months, notes: dto.notes ?? null }),
        ],
      );

      const schedule = await this.db.many(
        `select * from repayment_schedules where loan_id = $1 order by installment_no`,
        [loanId],
      );
      return { loan, holidayMonths: months, schedule };
    }

    // tenure_change or rate_change — rebuild unpaid schedule from remaining principal
    let outstandingPrincipal = 0;
    let outstandingInterest = 0;
    for (const row of unpaid) {
      const br = remainingBreakdown(row);
      outstandingPrincipal += br.principalRemaining;
      outstandingInterest += br.interestRemaining;
    }
    if (outstandingPrincipal < 1) {
      throw new BadRequestException('No outstanding principal to restructure');
    }

    const beforeTenure = Number(loan.tenure_months);
    const beforeRate = Number(loan.annual_rate_percent);

    let newTenureRemaining: number;
    let newRate = beforeRate;

    if (dto.kind === 'tenure_change') {
      if (
        dto.newTenureMonths == null ||
        !Number.isInteger(dto.newTenureMonths) ||
        dto.newTenureMonths < 1 ||
        dto.newTenureMonths > 360
      ) {
        throw new BadRequestException(
          'newTenureMonths must be an integer between 1 and 360',
        );
      }
      newTenureRemaining = dto.newTenureMonths;
      if (dto.newAnnualRatePercent != null) {
        newRate = Number(dto.newAnnualRatePercent);
      }
    } else {
      // rate_change keeps remaining installment count
      newTenureRemaining = unpaid.length;
      if (
        dto.newAnnualRatePercent == null ||
        !Number.isFinite(Number(dto.newAnnualRatePercent)) ||
        Number(dto.newAnnualRatePercent) < 0
      ) {
        throw new BadRequestException('newAnnualRatePercent is required');
      }
      newRate = Number(dto.newAnnualRatePercent);
    }

    // Close out unpaid rows that still have partial payments (keep history),
    // then delete unpaid rows with no payments so we can insert a fresh schedule.
    for (const row of unpaid) {
      const paid = Number(row.paid_cents ?? 0);
      if (paid > 0) {
        await this.db.query(
          `update repayment_schedules set status = 'paid' where id = $1`,
          [row.id],
        );
      } else {
        await this.db.query(`delete from repayment_schedules where id = $1`, [
          row.id,
        ]);
      }
    }

    const maxRow = await this.db.one<{ max: string | null }>(
      `select max(installment_no)::text as max
       from repayment_schedules where loan_id = $1`,
      [loanId],
    );
    const startInstallment = Number(maxRow?.max ?? 0);

    const startDate = new Date();
    const emi = calculateEmi({
      principalCents: outstandingPrincipal,
      annualRatePercent: newRate,
      tenureMonths: newTenureRemaining,
      interestMethod: loan.interest_method,
      startDate,
    });

    const afterTenure = startInstallment + newTenureRemaining;
    await this.db.query(
      `update loans
       set tenure_months = $2,
           annual_rate_percent = $3,
           updated_at = now()
       where id = $1`,
      [loanId, afterTenure, newRate],
    );

    let installmentNo = startInstallment;
    for (const row of emi.schedule) {
      installmentNo += 1;
      await this.db.query(
        `insert into repayment_schedules (
           loan_id, installment_no, due_date, principal_cents, interest_cents, total_cents, status
         ) values ($1,$2,$3,$4,$5,$6,'upcoming')`,
        [
          loanId,
          installmentNo,
          row.dueDate,
          row.principalCents,
          row.interestCents,
          row.paymentCents,
        ],
      );
    }

    const updatedLoan = await this.db.one('select * from loans where id = $1', [
      loanId,
    ]);

    await this.db.query(
      `insert into loan_restructures (
         loan_id, kind, actor_id, notes,
         before_tenure_months, after_tenure_months,
         before_annual_rate_percent, after_annual_rate_percent,
         outstanding_principal_cents, outstanding_interest_cents, meta
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        loanId,
        dto.kind,
        user.id,
        dto.notes?.trim() || null,
        beforeTenure,
        afterTenure,
        beforeRate,
        newRate,
        outstandingPrincipal,
        outstandingInterest,
        JSON.stringify({
          newTenureRemaining,
          monthlyEmiCents: emi.monthlyEmiCents,
        }),
      ],
    );
    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, $2, 'loan', $3, $4::jsonb)`,
      [
        user.id,
        `loan_${dto.kind}`,
        loanId,
        JSON.stringify({
          beforeTenure,
          afterTenure,
          beforeRate,
          afterRate: newRate,
          outstandingPrincipal,
          notes: dto.notes ?? null,
        }),
      ],
    );

    const schedule = await this.db.many(
      `select * from repayment_schedules where loan_id = $1 order by installment_no`,
      [loanId],
    );

    const borrowerHref = loan.application_id
      ? `/portal/loans/${loan.application_id}`
      : '/portal/loans';
    await this.notifications.notifyUser(loan.borrower_id, {
      kind: 'payment_recorded',
      title: 'Loan restructured',
      body:
        dto.kind === 'tenure_change'
          ? `Your remaining balance was rescheduled over ${newTenureRemaining} months.`
          : `Your interest rate was updated to ${newRate}%.`,
      href: borrowerHref,
      entityType: 'loan',
      entityId: loanId,
    });

    return {
      loan: updatedLoan,
      preview: emi,
      outstandingPrincipalCents: outstandingPrincipal,
      schedule,
    };
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
