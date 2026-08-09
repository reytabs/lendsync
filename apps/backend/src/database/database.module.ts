import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TenantContext } from './tenant-context';

@Global()
@Module({
  providers: [DatabaseService, TenantContext],
  exports: [DatabaseService, TenantContext],
})
export class DatabaseModule {}
