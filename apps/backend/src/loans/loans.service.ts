import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculateEmi } from '@lms/utils';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';
import { CreateLoanDto, LoanDecisionDto } from './loans.dto';

@Injectable()
export class LoansService {
  constructor(private readonly db: DatabaseService) {}

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
        `select * from repayment_schedules
         where loan_id = $1 order by installment_no`,
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
    return data;
  }

  async decide(id: string, user: AuthUser, dto: LoanDecisionDto) {
    const status = dto.decision === 'approved' ? 'approved' : 'rejected';
    const app = await this.db.one(
      `update loan_applications
       set status = $2::public.loan_status,
           officer_id = $3,
           decision_notes = $4,
           decided_at = now(),
           updated_at = now()
       where id = $1
       returning *`,
      [id, status, user.id, dto.notes ?? null],
    );
    if (!app) throw new BadRequestException('Application not found');

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

    if (dto.decision === 'rejected') return { application: app };

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
