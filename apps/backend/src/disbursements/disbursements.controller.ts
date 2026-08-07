import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { DisbursementsService } from './disbursements.service';

class CreateDisbursementDto {
  @IsUUID()
  loanId!: string;
}

@ApiTags('disbursements')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('disbursements')
export class DisbursementsController {
  constructor(private readonly disbursements: DisbursementsService) {}

  @Get()
  @Roles('loan_officer', 'admin')
  list() {
    return this.disbursements.list();
  }

  @Post()
  @Roles('loan_officer', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDisbursementDto) {
    return this.disbursements.create(user, dto.loanId);
  }
}
