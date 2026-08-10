import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(id: string) {
    const data = await this.db.one('select * from profiles where id = $1', [id]);
    if (!data) {
      return {
        id,
        email: '',
        full_name: 'Unknown',
        role: 'borrower',
        kyc_status: 'unverified',
      };
    }
    const { password_hash: _, ...rest } = data as Record<string, unknown>;
    return rest;
  }

  async updateProfile(
    id: string,
    dto: { fullName?: string; phone?: string; occupation?: string },
  ) {
    const data = await this.db.one(
      `update profiles set
         full_name = coalesce($2, full_name),
         phone = coalesce($3, phone),
         occupation = coalesce($4, occupation),
         updated_at = now()
       where id = $1
       returning *`,
      [id, dto.fullName ?? null, dto.phone ?? null, dto.occupation ?? null],
    );
    if (!data) throw new NotFoundException('Profile not found');
    const { password_hash: _, ...rest } = data as Record<string, unknown>;
    return rest;
  }

  async listBorrowers() {
    return this.db.many(
      `select
         p.id,
         p.email,
         p.full_name,
         p.phone,
         p.role,
         p.occupation,
         p.credit_score,
         p.kyc_status,
         p.created_at,
         p.updated_at,
         coalesce((
           select sum(l.principal_cents)::bigint
           from loans l
           where l.borrower_id = p.id
         ), 0) as total_borrowed_cents,
         coalesce((
           select count(*)::int
           from loans l
           where l.borrower_id = p.id
             and l.status = any(array['approved','disbursed','active']::public.loan_status[])
         ), 0) as active_loans,
         case
           when coalesce((
             select count(*) from repayment_schedules rs
             join loans l on l.id = rs.loan_id
             where l.borrower_id = p.id and rs.status in ('paid','overdue','partial')
           ), 0) = 0 then 100
           else round(
             100.0 * (
               select count(*) from repayment_schedules rs
               join loans l on l.id = rs.loan_id
               where l.borrower_id = p.id and rs.status = 'paid'
             ) / nullif((
               select count(*) from repayment_schedules rs
               join loans l on l.id = rs.loan_id
               where l.borrower_id = p.id and rs.status in ('paid','overdue','partial')
             ), 0)
           )::int
         end as on_time_rate
       from profiles p
       where p.role = 'borrower'
       order by p.full_name`,
    );
  }

  async createBorrower(
    actor: AuthUser,
    dto: {
      email: string;
      fullName: string;
      phone?: string;
      occupation?: string;
      creditScore?: number;
      password?: string;
    },
  ) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.db.one(
      'select id from profiles where email = $1',
      [email],
    );
    if (existing) throw new BadRequestException('Email already registered');

    if (
      dto.creditScore != null &&
      (dto.creditScore < 300 || dto.creditScore > 850)
    ) {
      throw new BadRequestException('Credit score must be between 300 and 850');
    }

    const tempPassword =
      dto.password?.trim() ||
      `Tmp!${Math.random().toString(36).slice(2, 10)}A1`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const profile = await this.db.one(
      `insert into profiles (
         email, full_name, phone, occupation, credit_score, role, password_hash,
         kyc_status, must_change_password
       ) values ($1, $2, $3, $4, $5, 'borrower', $6, 'pending', true)
       returning id, email, full_name, phone, occupation, credit_score, role, kyc_status, created_at`,
      [
        email,
        dto.fullName.trim(),
        dto.phone?.trim() || null,
        dto.occupation?.trim() || null,
        dto.creditScore ?? null,
        passwordHash,
      ],
    );
    if (!profile) throw new BadRequestException('Failed to create borrower');

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'borrower_create', 'profile', $2, $3::jsonb)`,
      [
        actor.id,
        profile.id,
        JSON.stringify({ email, fullName: dto.fullName }),
      ],
    );

    return {
      ...profile,
      tempPassword: dto.password ? undefined : tempPassword,
      total_borrowed_cents: 0,
      active_loans: 0,
      on_time_rate: 100,
    };
  }

  async deleteBorrower(actor: AuthUser, id: string) {
    const profile = await this.db.one<{
      id: string;
      email: string;
      full_name: string;
      role: string;
    }>('select id, email, full_name, role from profiles where id = $1', [id]);
    if (!profile || profile.role !== 'borrower') {
      throw new NotFoundException('Borrower not found');
    }

    const active = await this.db.one<{ count: string }>(
      `select count(*)::text as count from loans
       where borrower_id = $1
         and status = any(array['approved','disbursed','active']::public.loan_status[])`,
      [id],
    );
    if (Number(active?.count ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot delete borrower with approved or active loans. Close or complete them first.',
      );
    }

    const loanIds = await this.db.many<{ id: string }>(
      'select id from loans where borrower_id = $1',
      [id],
    );
    const ids = loanIds.map((l) => l.id);

    if (ids.length) {
      await this.db.query(
        `delete from repayments where loan_id = any($1::uuid[])`,
        [ids],
      );
      await this.db.query(
        `delete from repayment_schedules where loan_id = any($1::uuid[])`,
        [ids],
      );
      await this.db.query(
        `delete from disbursements where loan_id = any($1::uuid[])`,
        [ids],
      );
      await this.db.query(`delete from loans where borrower_id = $1`, [id]);
    }

    await this.db.query(
      `delete from borrower_documents where borrower_id = $1`,
      [id],
    );
    await this.db.query(
      `delete from loan_applications where borrower_id = $1`,
      [id],
    );
    // notifications cascade via FK; clear officer refs that might block delete
    await this.db.query(
      `update loan_applications set officer_id = null where officer_id = $1`,
      [id],
    );
    await this.db.query(
      `update loans set officer_id = null where officer_id = $1`,
      [id],
    );

    const deleted = await this.db.one(
      `delete from profiles where id = $1 and role = 'borrower' returning id`,
      [id],
    );
    if (!deleted) {
      throw new BadRequestException(
        'Unable to delete borrower — related records may still reference this profile',
      );
    }

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'borrower_delete', 'profile', $2, $3::jsonb)`,
      [
        actor.id,
        id,
        JSON.stringify({
          email: profile.email,
          fullName: profile.full_name,
        }),
      ],
    );

    return { ok: true, id };
  }
}
