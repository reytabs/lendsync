import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

export type ProductInput = {
  name: string;
  description?: string;
  loanType: string;
  interestMethod: string;
  annualRatePercent: number;
  minAmountCents: number;
  maxAmountCents: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  graceDays?: number;
  isActive?: boolean;
};

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async getSettings() {
    const data = await this.db.many<{ key: string; value: unknown }>(
      'select key, value from system_settings',
    );
    if (!data.length) {
      return {
        organization: { name: 'LendSync', currency: 'USD' },
        security: { require2fa: false, enforceTls: true, autoBackups: true },
        integrations: {
          stripe: { enabled: true },
          twilio: { enabled: false },
          experian: { enabled: false },
          docusign: { enabled: false },
        },
      };
    }
    return Object.fromEntries(data.map((row) => [row.key, row.value]));
  }

  async updateSetting(
    user: AuthUser,
    key: string,
    value: Record<string, unknown>,
  ) {
    const data = await this.db.one(
      `insert into system_settings (key, value, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (organization_id, key)
         do update set value = excluded.value, updated_at = now()
       returning *`,
      [key, JSON.stringify(value)],
    );
    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'settings_update', 'system_settings', $2, $3::jsonb)`,
      [user.id, key, JSON.stringify(value)],
    );
    return data;
  }

  async listUsers() {
    return this.db.many(
      `select id, email, full_name, phone, role, occupation, credit_score, kyc_status, created_at, updated_at
       from profiles order by created_at desc`,
    );
  }

  async inviteUser(
    actor: AuthUser,
    dto: { email: string; fullName: string; role: string },
  ) {
    const tempPassword = `Tmp!${Math.random().toString(36).slice(2, 10)}A1`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const profile = await this.db.one<{
      id: string;
      email: string;
      role: string;
    }>(
      `insert into profiles (email, full_name, role, password_hash)
       values ($1, $2, $3::public.user_role, $4)
       on conflict (organization_id, lower(email)) do update set
         full_name = excluded.full_name,
         role = excluded.role,
         password_hash = excluded.password_hash,
         updated_at = now()
       returning id, email, role, organization_id`,
      [dto.email.toLowerCase(), dto.fullName, dto.role, passwordHash],
    );
    if (!profile) throw new BadRequestException('Invite failed');

    // Staff need a membership so they carry an org role and appear in the org.
    const orgRole =
      dto.role === 'admin'
        ? 'admin'
        : dto.role === 'loan_officer'
          ? 'officer'
          : null;
    if (orgRole) {
      await this.db.query(
        `insert into memberships (organization_id, profile_id, role)
         select organization_id, id, $2::public.org_role
         from profiles where id = $1
         on conflict (organization_id, profile_id)
           do update set role = excluded.role`,
        [profile.id, orgRole],
      );
    }

    await this.db.query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, meta)
       values ($1, 'user_invite', 'profile', $2, $3::jsonb)`,
      [
        actor.id,
        profile.id,
        JSON.stringify({ email: dto.email, role: dto.role }),
      ],
    );
    return {
      id: profile.id,
      email: dto.email,
      role: dto.role,
      tempPassword,
    };
  }

  private assertProductBounds(dto: Partial<ProductInput>) {
    if (
      dto.minAmountCents != null &&
      dto.maxAmountCents != null &&
      dto.minAmountCents > dto.maxAmountCents
    ) {
      throw new BadRequestException('Min amount cannot exceed max amount');
    }
    if (
      dto.minTenureMonths != null &&
      dto.maxTenureMonths != null &&
      dto.minTenureMonths > dto.maxTenureMonths
    ) {
      throw new BadRequestException('Min tenure cannot exceed max tenure');
    }
  }

  async listProducts() {
    return this.db.many(
      `select * from loan_products
       order by is_active desc, name asc`,
    );
  }

  async createProduct(dto: ProductInput) {
    this.assertProductBounds(dto);
    const data = await this.db.one(
      `insert into loan_products (
         name, description, loan_type, interest_method, annual_rate_percent,
         min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months,
         grace_days, is_active
       ) values (
         $1,$2,$3::public.loan_type,$4::public.interest_method,$5,
         $6,$7,$8,$9,$10,$11
       )
       returning *`,
      [
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.loanType,
        dto.interestMethod,
        dto.annualRatePercent,
        dto.minAmountCents,
        dto.maxAmountCents,
        dto.minTenureMonths,
        dto.maxTenureMonths,
        dto.graceDays ?? 0,
        dto.isActive ?? true,
      ],
    );
    if (!data) throw new BadRequestException('Failed to create product');
    return data;
  }

  async updateProduct(id: string, dto: Partial<ProductInput>) {
    const existing = await this.db.one(
      'select * from loan_products where id = $1',
      [id],
    );
    if (!existing) throw new NotFoundException('Product not found');

    const next = {
      name: dto.name?.trim() ?? existing.name,
      description:
        dto.description !== undefined
          ? dto.description.trim() || null
          : existing.description,
      loanType: dto.loanType ?? existing.loan_type,
      interestMethod: dto.interestMethod ?? existing.interest_method,
      annualRatePercent:
        dto.annualRatePercent ?? Number(existing.annual_rate_percent),
      minAmountCents:
        dto.minAmountCents ?? Number(existing.min_amount_cents),
      maxAmountCents:
        dto.maxAmountCents ?? Number(existing.max_amount_cents),
      minTenureMonths:
        dto.minTenureMonths ?? Number(existing.min_tenure_months),
      maxTenureMonths:
        dto.maxTenureMonths ?? Number(existing.max_tenure_months),
      graceDays: dto.graceDays ?? Number(existing.grace_days),
      isActive: dto.isActive ?? Boolean(existing.is_active),
    };
    this.assertProductBounds(next);

    const data = await this.db.one(
      `update loan_products set
         name = $2,
         description = $3,
         loan_type = $4::public.loan_type,
         interest_method = $5::public.interest_method,
         annual_rate_percent = $6,
         min_amount_cents = $7,
         max_amount_cents = $8,
         min_tenure_months = $9,
         max_tenure_months = $10,
         grace_days = $11,
         is_active = $12,
         updated_at = now()
       where id = $1
       returning *`,
      [
        id,
        next.name,
        next.description,
        next.loanType,
        next.interestMethod,
        next.annualRatePercent,
        next.minAmountCents,
        next.maxAmountCents,
        next.minTenureMonths,
        next.maxTenureMonths,
        next.graceDays,
        next.isActive,
      ],
    );
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async setProductActive(id: string, isActive: boolean) {
    const data = await this.db.one(
      `update loan_products
       set is_active = $2, updated_at = now()
       where id = $1
       returning *`,
      [id, isActive],
    );
    if (!data) throw new NotFoundException('Product not found');
    return data;
  }

  async deleteProduct(id: string) {
    const existing = await this.db.one(
      'select id, name from loan_products where id = $1',
      [id],
    );
    if (!existing) throw new NotFoundException('Product not found');

    const inUse = await this.db.one<{ count: string }>(
      `select (
         (select count(*) from loan_applications where product_id = $1) +
         (select count(*) from loans where product_id = $1)
       )::text as count`,
      [id],
    );
    if (Number(inUse?.count ?? 0) > 0) {
      throw new BadRequestException(
        'Product is in use by applications or loans. Deactivate it instead.',
      );
    }

    await this.db.query('delete from loan_products where id = $1', [id]);
    return { ok: true, id };
  }

  async auditLogs() {
    return this.db.many(
      `select * from audit_logs order by created_at desc limit 100`,
    );
  }
}
