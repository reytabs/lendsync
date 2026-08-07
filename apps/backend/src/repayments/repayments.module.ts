import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [AuthModule],
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
})
export class RepaymentsModule {}
