import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow, type QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

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

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
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
}
