import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculateEmi } from '@lms/utils';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';
import { CreateLoanDto, LoanDecisionDto } from './loans.dto';
import { NotificationsService } from '../notifications/notifications.service';

function moneyLabel(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

@Injectable()
export class LoansService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, status?: string) {
    const params: unknown[] = [];
    const where: string[] = [];

    if (user.role === 'borrower') {
      params.push(user.id);
      where.push(`a.borrower_id = $${params.length}`);
    }
    if (status && status !== 'all') {
      const map: Record<string, string[]> = {
        pending: ['submitted', 'under_review', 'draft'],
        approved: ['approved'],
        disbursed: ['disbursed', 'active'],
        rejected: ['rejected'],
        closed: ['completed', 'closed', 'defaulted'],
      };
      const statuses = map[status] ?? [status];
      params.push(statuses);
      where.push(`a.status = any($${params.length}::public.loan_status[])`);
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    return this.db.many(
      `select a.*,
              jsonb_build_object('full_name', b.full_name, 'email', b.email) as borrower,
              case when o.id is null then null
                   else jsonb_build_object('full_name', o.full_name) end as officer,
              jsonb_build_object('name', p.name) as product
       from loan_applications a
       join profiles b on b.id = a.borrower_id
       left join profiles o on o.id = a.officer_id
       join loan_products p on p.id = a.product_id
       ${whereSql}
       order by a.created_at desc`,
      params,
    );
  }

  async get(id: string, user: AuthUser) {
    const data = await this.db.one(
      'select * from loan_applications where id = $1',
      [id],
    );
    if (!data) throw new NotFoundException('Application not found');
    if (user.role === 'borrower' && data.borrower_id !== user.id) {
      throw new NotFoundException('Application not found');
    }

    const loan = await this.db.one(
      'select * from loans where application_id = $1',
      [id],
    );
    let schedule: unknown[] = [];
    if (loan?.id) {
      schedule = await this.db.many(
        `select s.*,
                coalesce((
                  select sum(r.amount_cents)::bigint
                  from repayments r
                  where r.schedule_id = s.id
                ), 0) as paid_cents,
                greatest(
                  s.total_cents - coalesce((
                    select sum(r.amount_cents)::bigint
                    from repayments r
                    where r.schedule_id = s.id
                  ), 0),
                  0
                ) as remaining_cents
         from repayment_schedules s
         where s.loan_id = $1
         order by s.installment_no`,
        [loan.id],
      );
    }
    return { application: data, loan, schedule };
  }

  async create(user: AuthUser, dto: CreateLoanDto) {
    const product = await this.db.one(
      'select * from loan_products where id = $1',
      [dto.productId],
    );
    if (!product) throw new BadRequestException('Invalid product');
    if (
      dto.principalCents < Number(product.min_amount_cents) ||
      dto.principalCents > Number(product.max_amount_cents)
    ) {
      throw new BadRequestException('Amount outside product limits');
    }

    let borrowerId = user.id;
    if (dto.borrowerId) {
      if (!['admin', 'loan_officer'].includes(user.role)) {
        throw new BadRequestException('Cannot set borrower for this role');
      }
      const borrower = await this.db.one(
        `select id from profiles where id = $1 and role = 'borrower'`,
        [dto.borrowerId],
      );
      if (!borrower) throw new BadRequestException('Invalid borrower');
      borrowerId = dto.borrowerId;
    }

    const data = await this.db.one(
      `insert into loan_applications (
         borrower_id, product_id, loan_type, principal_cents, tenure_months,
         annual_rate_percent, purpose, status
       ) values ($1, $2, $3, $4, $5, $6, $7, 'draft')
       returning *`,
      [
        borrowerId,
        dto.productId,
        dto.loanType ?? product.loan_type,
        dto.principalCents,
        dto.tenureMonths,
        product.annual_rate_percent,
        dto.purpose ?? null,
      ],
    );
    return data;
  }

  async submit(id: string, user: AuthUser) {
    const params: unknown[] = [id];
    let where = 'id = $1';
    if (user.role === 'borrower') {
      params.push(user.id);
      where += ` and borrower_id = $2`;
    }
    const data = await this.db.one(
      `update loan_applications
       set status = 'submitted', submitted_at = now(), updated_at = now()
       where ${where}
       returning *`,
      params,
    );
    if (!data) throw new BadRequestException('Unable to submit application');

    const borrower = await this.db.one<{ full_name: string }>(
      'select full_name from profiles where id = $1',
      [data.borrower_id],
    );
    const amount = moneyLabel(Number(data.principal_cents));
    await this.notifications.notifyStaff({
      kind: 'loan_submitted',
      title: 'New loan application',
      body: `${borrower?.full_name ?? 'Borrower'} submitted ${amount}.`,
      href: '/applications',
      entityType: 'loan_application',
      entityId: data.id,
    });
    await this.notifications.notifyUser(data.borrower_id, {
      kind: 'loan_submitted',
      title: 'Application submitted',
      body: `Your ${amount} application is under review.`,
      href: `/portal/loans/${data.id}`,
      entityType: 'loan_application',
      entityId: data.id,
    });

    return data;
  }

  async decide(id: string, user: AuthUser, dto: LoanDecisionDto) {
    if (dto.decision === 'rejected' && !dto.notes?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const existing = await this.db.one(
      'select * from loan_applications where id = $1',
      [id],
    );
    if (!existing) throw new NotFoundException('Application not found');

    // Must match public.loan_status — "pending" is a UI filter alias only
    const decidable = ['submitted', 'under_review', 'draft'];
    if (!decidable.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot decide on application with status "${existing.status}"`,
      );
    }

    const status = dto.decision === 'approved' ? 'approved' : 'rejected';
    const app = await this.db.one(
      `update loan_applications
       set status = $2::public.loan_status,
           officer_id = $3,
           decision_notes = $4,
           decided_at = now(),
           updated_at = now()
       where id = $1
         and status = any($5::text[]::public.loan_status[])
       returning *`,
      [id, status, user.id, dto.notes?.trim() ?? null, decidable],
    );
    if (!app) {
      throw new BadRequestException(
        'Application was updated by someone else — refresh and try again',
      );
    }
    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, $2, 'loan_application', $3, $4::jsonb)`,
      [
        user.id,
        `loan_${dto.decision}`,
        id,
        JSON.stringify({ notes: dto.notes ?? null }),
      ],
    );

    const amount = moneyLabel(Number(app.principal_cents));
    if (dto.decision === 'rejected') {
      await this.notifications.notifyUser(app.borrower_id, {
        kind: 'loan_rejected',
        title: 'Application rejected',
        body: dto.notes?.trim()
          ? `Your ${amount} application was rejected: ${dto.notes.trim()}`
          : `Your ${amount} application was rejected.`,
        href: `/portal/loans/${app.id}`,
        entityType: 'loan_application',
        entityId: app.id,
      });
      return { application: app };
    }

    await this.notifications.notifyUser(app.borrower_id, {
      kind: 'loan_approved',
      title: 'Application approved',
      body: `Your ${amount} application was approved. EMI schedule is ready.`,
      href: `/portal/loans/${app.id}`,
      entityType: 'loan_application',
      entityId: app.id,
    });

    const product = await this.db.one(
      'select * from loan_products where id = $1',
      [app.product_id],
    );

    const loan = await this.db.one(
      `insert into loans (
         application_id, borrower_id, product_id, loan_type, principal_cents,
         tenure_months, annual_rate_percent, interest_method, status, officer_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9)
       returning *`,
      [
        app.id,
        app.borrower_id,
        app.product_id,
        app.loan_type,
        app.principal_cents,
        app.tenure_months,
        app.annual_rate_percent,
        product?.interest_method ?? 'reducing',
        user.id,
      ],
    );
    if (!loan) throw new BadRequestException('Failed to create loan');

    const emi = calculateEmi({
      principalCents: Number(loan.principal_cents),
      annualRatePercent: Number(loan.annual_rate_percent),
      tenureMonths: Number(loan.tenure_months),
      interestMethod: loan.interest_method,
    });

    for (const row of emi.schedule) {
      await this.db.query(
        `insert into repayment_schedules (
           loan_id, installment_no, due_date, principal_cents, interest_cents, total_cents, status
         ) values ($1,$2,$3,$4,$5,$6,'upcoming')`,
        [
          loan.id,
          row.month,
          row.dueDate,
          row.principalCents,
          row.interestCents,
          row.paymentCents,
        ],
      );
    }

    return { application: app, loan, schedulePreview: emi };
  }

  async listProducts() {
    return this.db.many(
      `select * from loan_products where is_active = true order by name`,
    );
  }
}
