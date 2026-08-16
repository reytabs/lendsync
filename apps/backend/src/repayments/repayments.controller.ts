import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
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

class EarlySettleDto {
  @IsOptional()
  @IsBoolean()
  waiveInterest?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RestructureDto {
  @IsIn(['tenure_change', 'payment_holiday', 'rate_change'])
  kind!: 'tenure_change' | 'payment_holiday' | 'rate_change';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(360)
  newTenureMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newAnnualRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  holidayMonths?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('repayments')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('repayments')
export class RepaymentsController {
  constructor(private readonly repayments: RepaymentsService) {}

  @Get('due')
  @Roles('loan_officer', 'admin', 'borrower', 'viewer', 'collector')
  listDue(@CurrentUser() user: AuthUser) {
    return this.repayments.listDue(user);
  }

  @Get('loans/:loanId/payoff')
  @Roles('loan_officer', 'admin', 'viewer', 'collector', 'borrower')
  payoffQuote(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string) {
    return this.repayments.payoffQuote(loanId, user);
  }

  @Post('loans/:loanId/early-settle')
  @Roles('loan_officer', 'admin')
  earlySettle(
    @CurrentUser() user: AuthUser,
    @Param('loanId') loanId: string,
    @Body() dto: EarlySettleDto,
  ) {
    return this.repayments.earlySettle(user, loanId, dto);
  }

  @Post('loans/:loanId/restructure')
  @Roles('loan_officer', 'admin')
  restructure(
    @CurrentUser() user: AuthUser,
    @Param('loanId') loanId: string,
    @Body() dto: RestructureDto,
  ) {
    return this.repayments.restructure(user, loanId, dto);
  }

  @Post()
  @Roles('loan_officer', 'admin', 'collector')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRepaymentDto) {
    return this.repayments.create(user, dto);
  }
}
