import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { calculateEmi } from '@lms/utils';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { CalculateEmiDto, CreateLoanDto, LoanDecisionDto } from './loans.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get('loan-products')
  products() {
    return this.loans.listProducts();
  }

  @Get('loans')
  @Roles('borrower', 'admin', 'loan_officer', 'viewer', 'collector')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.loans.list(user, status);
  }

  @Get('loans/:id')
  @Roles('borrower', 'admin', 'loan_officer', 'viewer', 'collector')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loans.get(id, user);
  }

  @Post('loans')
  @Roles('borrower', 'admin', 'loan_officer')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLoanDto) {
    return this.loans.create(user, dto);
  }

  @Post('loans/:id/submit')
  @Roles('borrower', 'admin', 'loan_officer')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loans.submit(id, user);
  }

  @Post('loans/:id/decision')
  @Roles('loan_officer', 'admin')
  decide(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: LoanDecisionDto,
  ) {
    return this.loans.decide(id, user, dto);
  }

  @Post('repayments/calculate-emi')
  calculate(@Body() dto: CalculateEmiDto) {
    return calculateEmi(dto);
  }
}
