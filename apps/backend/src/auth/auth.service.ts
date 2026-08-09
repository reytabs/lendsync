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
    const row = await this.db.one<{ role: OrgRole }>(
      `select role from memberships
       where profile_id = $1 and organization_id = $2`,
      [profileId, orgId],
    );
    return row?.role;
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
    const existing = await this.db.one(
      `select id from profiles
       where email = $1 and organization_id = $2`,
      [dto.email.toLowerCase(), DEFAULT_ORG_ID],
    );
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const profile = await this.db.one<ProfileRow>(
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
    const profile = await this.db.one<ProfileRow>(
      `select id, email, full_name, role, password_hash, organization_id
       from profiles where email = $1
       order by created_at asc
       limit 1`,
      [dto.email.toLowerCase()],
    );
    if (!profile?.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, profile.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const orgRole = await this.orgRoleFor(
      profile.id,
      profile.organization_id ?? DEFAULT_ORG_ID,
    );
    return this.signToken(profile, orgRole);
  }
}
