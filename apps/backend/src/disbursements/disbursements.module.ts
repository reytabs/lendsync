import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DisbursementsController } from './disbursements.controller';
import { DisbursementsService } from './disbursements.service';

@Module({
  imports: [AuthModule],
  controllers: [DisbursementsController],
  providers: [DisbursementsService],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
