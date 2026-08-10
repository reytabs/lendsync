import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { UserRole } from '@lms/types';
import { DatabaseService } from '../database/database.service';
import { DEFAULT_ORG_ID, type OrgRole } from './auth.guards';
import { LoginDto, RegisterDto } from './auth.dto';

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string | null;
  organization_id: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /** Membership role for a profile within an org, if any (borrowers have none). */
  private async orgRoleFor(
    profileId: string,
    orgId: string,
  ): Promise<OrgRole | undefined> {
    const row = await this.db.oneUnscoped<{ role: OrgRole }>(
      `select role from memberships
       where profile_id = $1 and organization_id = $2`,
      [profileId, orgId],
    );
    return row?.role;
  }

  /**
   * Staff who signed up multiple workspaces before identity-reuse landed end up
   * with one profile per org. Copy sibling memberships onto the profile that
   * just authenticated so the org switcher (and tenant scope) can see every
   * workspace for that email.
   */
  private async unifyStaffMemberships(profile: ProfileRow): Promise<void> {
    if (profile.role === 'borrower') return;

    const siblings = await this.db.manyUnscoped<{
      id: string;
      organization_id: string | null;
    }>(
      `select id, organization_id from profiles
       where lower(email) = lower($1)
         and id <> $2
         and role in ('admin', 'loan_officer')`,
      [profile.email, profile.id],
    );

    for (const sib of siblings) {
      await this.db.queryUnscoped(
        `insert into memberships (organization_id, profile_id, role)
         select organization_id, $1, role
         from memberships
         where profile_id = $2
         on conflict (organization_id, profile_id) do nothing`,
        [profile.id, sib.id],
      );

      if (sib.organization_id) {
        await this.db.queryUnscoped(
          `insert into memberships (organization_id, profile_id, role)
           values ($1, $2, 'owner')
           on conflict (organization_id, profile_id) do nothing`,
          [sib.organization_id, profile.id],
        );
      }
    }
  }

  /** Prefer the newest membership org so newly created workspaces are active. */
  private async preferredOrg(
    profileId: string,
    fallbackOrgId: string,
  ): Promise<{ orgId: string; orgRole?: OrgRole }> {
    const row = await this.db.oneUnscoped<{
      organization_id: string;
      role: OrgRole;
    }>(
      `select m.organization_id, m.role
       from memberships m
       join organizations o on o.id = m.organization_id
       where m.profile_id = $1
       order by o.created_at desc
       limit 1`,
      [profileId],
    );
    if (row) return { orgId: row.organization_id, orgRole: row.role };
    return { orgId: fallbackOrgId };
  }

  signToken(profile: ProfileRow, orgRole?: OrgRole) {
    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
    const orgId = profile.organization_id ?? DEFAULT_ORG_ID;
    const access_token = jwt.sign(
      {
        sub: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
        org_id: orgId,
        org_role: orgRole,
      },
      secret,
      { expiresIn: '7d' },
    );
    return {
      access_token,
      token_type: 'bearer',
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        organization_id: orgId,
        org_role: orgRole ?? null,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.db.oneUnscoped(
      `select id from profiles
       where email = $1 and organization_id = $2`,
      [dto.email.toLowerCase(), DEFAULT_ORG_ID],
    );
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const profile = await this.db.oneUnscoped<ProfileRow>(
      `insert into profiles (email, full_name, phone, password_hash, role, organization_id)
       values ($1, $2, $3, $4, 'borrower', $5)
       returning id, email, full_name, role, password_hash, organization_id`,
      [
        dto.email.toLowerCase(),
        dto.fullName,
        dto.phone ?? null,
        passwordHash,
        DEFAULT_ORG_ID,
      ],
    );
    if (!profile) throw new BadRequestException('Registration failed');
    return this.signToken(profile);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    // Unscoped: same email can exist on multiple org-local profiles (legacy
    // duplicate signups). We must see all of them to pick the right identity.
    const profiles = await this.db.manyUnscoped<ProfileRow>(
      `select id, email, full_name, role, password_hash, organization_id
       from profiles
       where lower(email) = $1
       order by
         case when role in ('admin', 'loan_officer') then 0 else 1 end,
         (
           select max(a.created_at)
           from loan_applications a
           where a.borrower_id = profiles.id
         ) desc nulls last,
         created_at desc`,
      [email],
    );

    let matched: ProfileRow | null = null;
    for (const profile of profiles) {
      if (!profile.password_hash) continue;
      const ok = await bcrypt.compare(dto.password, profile.password_hash);
      if (!ok) continue;
      matched = profile;
      // Prefer the first password match in staff-first / newest-first order.
      break;
    }

    if (!matched) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.unifyStaffMemberships(matched);

    const fallbackOrg = matched.organization_id ?? DEFAULT_ORG_ID;
    const preferred = await this.preferredOrg(matched.id, fallbackOrg);
    const orgRole =
      preferred.orgRole ??
      (await this.orgRoleFor(matched.id, preferred.orgId));

    return this.signToken(
      { ...matched, organization_id: preferred.orgId },
      orgRole,
    );
  }
}
