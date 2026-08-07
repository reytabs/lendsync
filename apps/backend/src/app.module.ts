import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LoansModule } from './loans/loans.module';
import { DocumentsModule } from './documents/documents.module';
import { DisbursementsModule } from './disbursements/disbursements.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { StripeModule } from './stripe/stripe.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    LoansModule,
    DocumentsModule,
    DisbursementsModule,
    RepaymentsModule,
    ReportsModule,
    AdminModule,
    StripeModule,
  ],
})
export class AppModule {}
