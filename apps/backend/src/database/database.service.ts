import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Pool,
  type PoolClient,
  type QueryResultRow,
  type QueryResult,
} from 'pg';
import { TenantContext } from './tenant-context';

/**
 * A thin query surface backed by a single checked-out client. Handed to
 * `withTenant` callbacks so every statement runs inside the same RLS-scoped
 * transaction.
 */
export interface TenantDb {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null>;
  many<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(
    private readonly config: ConfigService,
    private readonly tenant: TenantContext,
  ) {}

  onModuleInit() {
    const connectionString =
      this.config.get<string>('DATABASE_URL') ??
      'postgresql://kevinreytabada@localhost:5432/lending';
    this.pool = new Pool({ connectionString });
    this.logger.log(`Connected to Postgres (${connectionString.replace(/:[^:@/]+@/, ':***@')})`);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  /**
   * Tenant-aware query. When an org is active in the TenantContext, the
   * statement runs inside a short transaction as the restricted `lms_tenant`
   * role with `app.current_org` set, so RLS enforces isolation. Otherwise it
   * runs directly on the pool (owner role) — used by public routes and jobs.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const orgId = this.tenant.getOrgId();
    if (!orgId) return this.pool.query<T>(text, params);
    return this.runScoped<T>(orgId, text, params);
  }

  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] ?? null;
  }

  async many<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const res = await this.query<T>(text, params);
    return res.rows;
  }

  /** Runs a single statement inside a tenant-scoped transaction. */
  private async runScoped<T extends QueryResultRow = QueryResultRow>(
    orgId: string,
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role lms_tenant');
      await client.query('select set_config($1, $2, true)', [
        'app.current_org',
        orgId,
      ]);
      const res = await client.query<T>(text, params);
      await client.query('commit');
      return res;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Unscoped escape hatches (bypass tenant scoping, run as pool owner) ---
  // Use only for cross-tenant operations such as the org switcher.

  async queryUnscoped<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async oneUnscoped<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const res = await this.pool.query<T>(text, params);
    return res.rows[0] ?? null;
  }

  async manyUnscoped<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const res = await this.pool.query<T>(text, params);
    return res.rows;
  }

  /**
   * Runs `fn` inside a transaction scoped to a single organization. The
   * connection switches into the restricted `lms_tenant` role and sets the
   * `app.current_org` GUC, so Postgres RLS policies enforce isolation for the
   * duration of the callback. Both the role and GUC are transaction-local and
   * reset automatically on commit/rollback.
   */
  async withTenant<T>(
    organizationId: string,
    fn: (db: TenantDb) => Promise<T>,
  ): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role lms_tenant');
      await client.query('select set_config($1, $2, true)', [
        'app.current_org',
        organizationId,
      ]);

      const scoped: TenantDb = {
        query: (text, params) => client.query(text, params),
        one: async (text, params) => {
          const res = await client.query(text, params);
          return res.rows[0] ?? null;
        },
        many: async (text, params) => {
          const res = await client.query(text, params);
          return res.rows;
        },
      };

      const result = await this.tenant.run(organizationId, () => fn(scoped));
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
