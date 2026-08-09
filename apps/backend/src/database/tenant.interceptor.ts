import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth.guards';
import { TenantContext } from './tenant-context';

/**
 * Runs each request handler inside the tenant's AsyncLocalStorage scope so that
 * DatabaseService auto-scopes queries. Guards run before interceptors, so
 * req.user (and its orgId) is already populated here. Requests without an
 * authenticated user (public routes, webhooks) run unscoped.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const orgId = (req?.user as AuthUser | undefined)?.orgId;
    if (!orgId) return next.handle();

    return new Observable((subscriber) => {
      this.tenant.run(orgId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
