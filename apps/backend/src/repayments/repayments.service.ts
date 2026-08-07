import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

@Injectable()
export class RepaymentsService {
  constructor(private readonly db: DatabaseService) {}

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

    let scheduleId = dto.scheduleId;
    if (!scheduleId) {
      const next = await this.db.one(
        `select * from repayment_schedules
         where loan_id = $1 and status = any(array['upcoming','overdue','partial']::public.schedule_status[])
         order by installment_no
         limit 1`,
        [dto.loanId],
      );
      scheduleId = next?.id;
      if (next) {
        const newStatus =
          dto.amountCents >= Number(next.total_cents) ? 'paid' : 'partial';
        await this.db.query(
          `update repayment_schedules set status = $2::public.schedule_status where id = $1`,
          [next.id, newStatus],
        );
      }
    } else {
      await this.db.query(
        `update repayment_schedules set status = 'paid' where id = $1`,
        [scheduleId],
      );
    }

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

    return data;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue() {
    await this.db.query(
      `update repayment_schedules
       set status = 'overdue'
       where status = 'upcoming' and due_date < current_date`,
    );
  }
}
