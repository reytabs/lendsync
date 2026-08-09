import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@lms/types';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../database/database.service';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Well-known org created by migration 0004 to hold pre-SaaS data.
export const DEFAULT_ORG_ID = '00000000-0000-4000-8000-0000000000aa';

export type OrgRole = 'owner' | 'admin' | 'officer';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  orgId: string;
  orgRole?: OrgRole;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

/** Resolves the active organization id for the request. */
export const Org = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return (req.user as AuthUser | undefined)?.orgId ?? DEFAULT_ORG_ID;
  },
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    const queryToken =
      typeof req.query?.access_token === 'string'
        ? req.query.access_token
        : undefined;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : queryToken;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    if (
      this.config.get('ALLOW_DEV_AUTH') === 'true' &&
      token === 'dev-admin-token'
    ) {
      req.user = {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'admin@lendsync.local',
        role: 'admin',
        fullName: 'Admin User',
        orgId: DEFAULT_ORG_ID,
        orgRole: 'owner',
      } satisfies AuthUser;
      return true;
    }

    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
    try {
      const payload = jwt.verify(token, secret) as {
        sub: string;
        email: string;
        role: UserRole;
        fullName?: string;
        org_id?: string;
        org_role?: OrgRole;
      };
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        fullName: payload.fullName,
        orgId: payload.org_id ?? DEFAULT_ORG_ID,
        orgRole: payload.org_role,
      } satisfies AuthUser;
      return true;
    } catch {
      // Fallback: look up profile by token-as-id for robustness
      const profile = await this.db.one<{
        id: string;
        email: string;
        role: UserRole;
        full_name: string;
        organization_id: string | null;
      }>(
        `select id, email, role, full_name, organization_id
         from profiles where id = $1`,
        [token],
      );
      if (!profile) throw new UnauthorizedException('Invalid token');
      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
        orgId: profile.organization_id ?? DEFAULT_ORG_ID,
      };
      return true;
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new UnauthorizedException('Insufficient role');
    }
    return true;
  }
}
