import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { RepaymentsService } from './repayments.service';

class CreateRepaymentDto {
  @IsUUID()
  loanId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  stripePaymentIntentId?: string;
}

@ApiTags('repayments')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('repayments')
export class RepaymentsController {
  constructor(private readonly repayments: RepaymentsService) {}

  @Get('due')
  @Roles('loan_officer', 'admin', 'borrower')
  listDue(@CurrentUser() user: AuthUser) {
    return this.repayments.listDue(user);
  }

  @Post()
  @Roles('loan_officer', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRepaymentDto) {
    return this.repayments.create(user, dto);
  }
}
