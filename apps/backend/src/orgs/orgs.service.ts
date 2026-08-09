import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
   */
  async signup(dto: SignupDto) {
    const slug = await this.uniqueSlug(this.slugify(dto.organizationName));
    const currency = dto.currency ?? 'USD';
    const planCode = dto.planCode ?? 'starter';

    const org = await this.db.one<{ id: string }>(
      `insert into organizations (name, slug, currency, status, trial_ends_at)
       values ($1, $2, $3, 'active', now() + ($4 || ' days')::interval)
       returning id`,
      [dto.organizationName, slug, currency, String(TRIAL_DAYS)],
    );
    if (!org) throw new BadRequestException('Could not create organization');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const profile = await this.db.one<{
      id: string;
      email: string;
      full_name: string;
      role: 'admin';
      organization_id: string;
    }>(
      `insert into profiles (email, full_name, password_hash, role, organization_id)
       values ($1, $2, $3, 'admin', $4)
       returning id, email, full_name, role, organization_id`,
      [dto.email.toLowerCase(), dto.fullName, passwordHash, org.id],
    );
    if (!profile) throw new BadRequestException('Could not create owner account');

    await this.db.query(
      `insert into memberships (organization_id, profile_id, role)
       values ($1, $2, 'owner')`,
      [org.id, profile.id],
    );

    await this.db.query(
      `insert into subscriptions (organization_id, plan_code, status, current_period_end)
       values ($1, $2, 'trialing', now() + ($3 || ' days')::interval)`,
      [org.id, planCode, String(TRIAL_DAYS)],
    );

    // Per-tenant default settings.
    await this.db.query(
      `insert into system_settings (organization_id, key, value)
       values ($1, 'currency', to_jsonb($2::text)),
              ($1, 'organization_name', to_jsonb($3::text))
       on conflict (organization_id, key) do nothing`,
      [org.id, currency, dto.organizationName],
    );

    return this.auth.signToken(
      { ...profile, password_hash: null },
      'owner',
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
