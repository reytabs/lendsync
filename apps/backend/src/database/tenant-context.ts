import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type TenantStore = {
  orgId: string;
};

/**
 * Carries the active organization id for the current async execution using
 * AsyncLocalStorage. Set once per request by TenantInterceptor (or explicitly
 * for background jobs), it lets DatabaseService transparently scope every query
 * to the tenant without threading orgId through call sites.
 */
@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(orgId: string, fn: () => T): T {
    return this.als.run({ orgId }, fn);
  }

  getOrgId(): string | undefined {
    return this.als.getStore()?.orgId;
  }
}
