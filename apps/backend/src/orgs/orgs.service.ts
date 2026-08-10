import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { UserRole } from '@lms/types';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import type { OrgRole } from '../auth/auth.guards';
import { SignupDto } from './orgs.dto';

const TRIAL_DAYS = 14;

type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: OrgRole;
  plan_code: string | null;
  status: string;
};

@Injectable()
export class OrgsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  private slugify(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org';
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const taken = await this.db.one('select 1 from organizations where slug = $1', [
        slug,
      ]);
      if (!taken) return slug;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  /**
   * Self-serve tenant creation. Runs on the owner connection (RLS-exempt)
   * because a brand-new organization cannot yet scope to itself.
   *
   * If the email already exists, reuse that profile (password must match)
   * and attach a membership to the new org — do not create a second identity.
   * Duplicate profiles per email break login (first profile wins) and hide
   * applications across workspaces under RLS.
   */
  async signup(dto: SignupDto) {
    const slug = await this.uniqueSlug(this.slugify(dto.organizationName));
    const currency = dto.currency ?? 'USD';
    const planCode = dto.planCode ?? 'starter';
    const email = dto.email.toLowerCase();

    const existing = await this.db.oneUnscoped<{
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      password_hash: string | null;
      organization_id: string | null;
    }>(
      `select id, email, full_name, role, password_hash, organization_id
       from profiles
       where lower(email) = $1
       order by
         case when role in ('admin', 'loan_officer') then 0 else 1 end,
         created_at asc
       limit 1`,
      [email],
    );

    if (
      existing &&
      (!existing.password_hash ||
        !(await bcrypt.compare(dto.password, existing.password_hash)))
    ) {
      throw new BadRequestException(
        'Email already registered. Sign in, then create another workspace from your account.',
      );
    }

    const org = await this.db.oneUnscoped<{ id: string }>(
      `insert into organizations (name, slug, currency, status, trial_ends_at)
       values ($1, $2, $3, 'active', now() + ($4 || ' days')::interval)
       returning id`,
      [dto.organizationName, slug, currency, String(TRIAL_DAYS)],
    );
    if (!org) throw new BadRequestException('Could not create organization');

    let profile: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      organization_id: string | null;
      password_hash: string | null;
    };

    if (existing) {
      // Promote borrower → admin when they create a workspace.
      if (existing.role === 'borrower') {
        await this.db.queryUnscoped(
          `update profiles
           set role = 'admin',
               full_name = coalesce(nullif($2, ''), full_name),
               organization_id = $3,
               updated_at = now()
           where id = $1`,
          [existing.id, dto.fullName, org.id],
        );
      } else {
        await this.db.queryUnscoped(
          `update profiles
           set organization_id = $2,
               full_name = coalesce(nullif($3, ''), full_name),
               updated_at = now()
           where id = $1`,
          [existing.id, org.id, dto.fullName],
        );
      }
      profile = {
        ...existing,
        role: existing.role === 'borrower' ? 'admin' : existing.role,
        organization_id: org.id,
        full_name: dto.fullName || existing.full_name,
      };
    } else {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const created = await this.db.oneUnscoped<{
        id: string;
        email: string;
        full_name: string;
        role: 'admin';
        organization_id: string;
      }>(
        `insert into profiles (email, full_name, password_hash, role, organization_id)
         values ($1, $2, $3, 'admin', $4)
         returning id, email, full_name, role, organization_id`,
        [email, dto.fullName, passwordHash, org.id],
      );
      if (!created) {
        throw new BadRequestException('Could not create owner account');
      }
      profile = { ...created, password_hash: null };
    }

    await this.db.queryUnscoped(
      `insert into memberships (organization_id, profile_id, role)
       values ($1, $2, 'owner')
       on conflict (organization_id, profile_id) do update set role = 'owner'`,
      [org.id, profile.id],
    );

    await this.db.queryUnscoped(
      `insert into subscriptions (organization_id, plan_code, status, current_period_end)
       values ($1, $2, 'trialing', now() + ($3 || ' days')::interval)`,
      [org.id, planCode, String(TRIAL_DAYS)],
    );

    // Per-tenant default settings (shape expected by /settings/public + Admin).
    await this.db.queryUnscoped(
      `insert into system_settings (organization_id, key, value)
       values (
         $1,
         'organization',
         jsonb_build_object('name', $3::text, 'currency', $2::text)
       )
       on conflict (organization_id, key)
         do update set value = excluded.value, updated_at = now()`,
      [org.id, currency, dto.organizationName],
    );

    await this.seedDefaultProducts(org.id);

    return this.auth.signToken(
      { ...profile, password_hash: null },
      'owner',
    );
  }

  /** Starter catalogue so a new workspace can accept applications immediately. */
  private async seedDefaultProducts(organizationId: string) {
    await this.db.queryUnscoped(
      `insert into loan_products (
         organization_id, name, description, loan_type, interest_method,
         annual_rate_percent, min_amount_cents, max_amount_cents,
         min_tenure_months, max_tenure_months, grace_days, is_active
       )
       select $1, v.*
       from (values
         ('Business Growth', 'Working capital for SMEs', 'business'::public.loan_type, 'reducing'::public.interest_method, 12.5, 1000000::bigint, 50000000::bigint, 6, 60, 5, true),
         ('Personal Flex', 'Unsecured personal loan', 'personal'::public.loan_type, 'reducing'::public.interest_method, 14.0, 50000::bigint, 10000000::bigint, 3, 36, 3, true),
         ('Home Equity Plus', 'Secured against property', 'home_equity'::public.loan_type, 'reducing'::public.interest_method, 9.5, 5000000::bigint, 100000000::bigint, 12, 120, 7, true),
         ('Auto Finance', 'Vehicle financing', 'auto'::public.loan_type, 'reducing'::public.interest_method, 11.0, 200000::bigint, 30000000::bigint, 12, 72, 5, true),
         ('Micro Boost', 'Microenterprise starter', 'micro'::public.loan_type, 'flat'::public.interest_method, 18.0, 10000::bigint, 500000::bigint, 3, 18, 0, true)
       ) as v(name, description, loan_type, interest_method, annual_rate_percent, min_amount_cents, max_amount_cents, min_tenure_months, max_tenure_months, grace_days, is_active)
       where not exists (
         select 1 from loan_products lp where lp.organization_id = $1
       )`,
      [organizationId],
    );
  }

  /**
   * Organizations the given profile can access (via membership). Unscoped
   * because it deliberately spans tenants (this powers the org switcher).
   */
  async listForProfile(profileId: string): Promise<OrgSummary[]> {
    return this.db.manyUnscoped<OrgSummary>(
      `select o.id, o.name, o.slug, o.currency, m.role,
              s.plan_code, o.status
       from memberships m
       join organizations o on o.id = m.organization_id
       left join subscriptions s on s.organization_id = o.id
       where m.profile_id = $1
       order by o.created_at asc`,
      [profileId],
    );
  }

  /** Re-issue a token scoped to a different org the user is a member of. */
  async switchOrg(profileId: string, organizationId: string) {
    const membership = await this.db.oneUnscoped<{ role: OrgRole }>(
      `select role from memberships
       where profile_id = $1 and organization_id = $2`,
      [profileId, organizationId],
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of that organization');
    }
    const profile = await this.db.oneUnscoped<{
      id: string;
      email: string;
      full_name: string;
      role: 'admin' | 'loan_officer' | 'borrower';
    }>(
      `select id, email, full_name, role from profiles where id = $1`,
      [profileId],
    );
    if (!profile) throw new ForbiddenException('Profile not found');
    return this.auth.signToken(
      {
        ...profile,
        password_hash: null,
        organization_id: organizationId,
      },
      membership.role,
    );
  }
}
