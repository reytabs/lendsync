import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';
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
export class DisbursementsService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key && !key.includes('xxx')) {
      this.stripe = new Stripe(key);
    }
  }

  async list() {
    return this.db.many(
      `select d.*,
              to_jsonb(l.*) as loan
       from disbursements d
       join loans l on l.id = d.loan_id
       order by d.created_at desc`,
    );
  }

  async create(user: AuthUser, loanId: string) {
    const loan = await this.db.one('select * from loans where id = $1', [
      loanId,
    ]);
    if (!loan) throw new BadRequestException('Loan not found');
    if (!['approved', 'disbursed'].includes(loan.status)) {
      throw new BadRequestException('Loan not ready for disbursement');
    }

    let stripeTransferId: string | null = null;
    if (this.stripe) {
      const intent = await this.stripe.paymentIntents.create({
        amount: Number(loan.principal_cents),
        currency: (this.config.get('CURRENCY') ?? 'usd').toLowerCase(),
        description: `LendSync disbursement ${loan.id}`,
        metadata: { loanId: loan.id },
        confirm: false,
      });
      stripeTransferId = intent.id;
    } else {
      stripeTransferId = `sim_transfer_${String(loan.id).slice(0, 8)}`;
    }

    const disbursement = await this.db.one(
      `insert into disbursements (
         loan_id, amount_cents, status, stripe_transfer_id, initiated_by
       ) values ($1, $2, $3::public.disbursement_status, $4, $5)
       returning *`,
      [
        loanId,
        loan.principal_cents,
        this.stripe ? 'processing' : 'succeeded',
        stripeTransferId,
        user.id,
      ],
    );
    if (!disbursement) throw new BadRequestException('Disbursement failed');

    if (!this.stripe) {
      await this.markSucceeded(loanId, disbursement.id);
    }

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'disburse', 'loan', $2, $3::jsonb)`,
      [
        user.id,
        loanId,
        JSON.stringify({ disbursementId: disbursement.id }),
      ],
    );

    return disbursement;
  }

  async markSucceeded(loanId: string, disbursementId: string) {
    await this.db.query(
      `update disbursements
       set status = 'succeeded', updated_at = now()
       where id = $1`,
      [disbursementId],
    );
    const loan = await this.db.one<{
      application_id: string;
      borrower_id: string;
      principal_cents: string | number;
    }>(
      `update loans
       set status = 'active', disbursed_at = now(), updated_at = now()
       where id = $1
       returning application_id, borrower_id, principal_cents`,
      [loanId],
    );
    if (loan?.application_id) {
      await this.db.query(
        `update loan_applications
         set status = 'disbursed', updated_at = now()
         where id = $1`,
        [loan.application_id],
      );
    }

    if (loan) {
      const amount = moneyLabel(Number(loan.principal_cents));
      const borrower = await this.db.one<{ full_name: string }>(
        'select full_name from profiles where id = $1',
        [loan.borrower_id],
      );
      await this.notifications.notifyUser(loan.borrower_id, {
        kind: 'loan_disbursed',
        title: 'Loan disbursed',
        body: `${amount} has been disbursed to your account.`,
        href: `/portal/loans/${loan.application_id}`,
        entityType: 'loan',
        entityId: loanId,
      });
      await this.notifications.notifyStaff({
        kind: 'loan_disbursed',
        title: 'Disbursement completed',
        body: `${amount} disbursed to ${borrower?.full_name ?? 'borrower'}.`,
        href: '/repayments',
        entityType: 'loan',
        entityId: loanId,
      });
    }
  }
}
