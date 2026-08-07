import { Module } from '@nestjs/common';
import { DisbursementsModule } from '../disbursements/disbursements.module';
import { StripeController } from './stripe.controller';

@Module({
  imports: [DisbursementsModule],
  controllers: [StripeController],
})
export class StripeModule {}
