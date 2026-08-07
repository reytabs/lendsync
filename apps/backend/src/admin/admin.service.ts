import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

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
       on conflict (key) do update set value = excluded.value, updated_at = now()
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
    const profile = await this.db.one(
      `insert into profiles (email, full_name, role, password_hash)
       values ($1, $2, $3::public.user_role, $4)
       on conflict (email) do update set
         full_name = excluded.full_name,
         role = excluded.role,
         password_hash = excluded.password_hash,
         updated_at = now()
       returning id, email, role`,
      [dto.email.toLowerCase(), dto.fullName, dto.role, passwordHash],
    );
    if (!profile) throw new BadRequestException('Invite failed');
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

  async listProducts() {
    return this.db.many('select * from loan_products order by name');
  }

  async createProduct(dto: {
    name: string;
    description?: string;
    loanType: string;
    interestMethod: string;
    annualRatePercent: number;
    minAmountCents: number;
    maxAmountCents: number;
    minTenureMonths: number;
    maxTenureMonths: number;
  }) {
    const data = await this.db.one(
      `insert into loan_products (
         name, description, loan_type, interest_method, annual_rate_percent,
         min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months
       ) values ($1,$2,$3::public.loan_type,$4::public.interest_method,$5,$6,$7,$8,$9)
       returning *`,
      [
        dto.name,
        dto.description ?? null,
        dto.loanType,
        dto.interestMethod,
        dto.annualRatePercent,
        dto.minAmountCents,
        dto.maxAmountCents,
        dto.minTenureMonths,
        dto.maxTenureMonths,
      ],
    );
    if (!data) throw new BadRequestException('Failed to create product');
    return data;
  }

  async auditLogs() {
    return this.db.many(
      `select * from audit_logs order by created_at desc limit 100`,
    );
  }
}
