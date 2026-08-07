import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { AdminService } from './admin.service';

class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsIn(['loan_officer', 'admin', 'borrower'])
  role!: 'loan_officer' | 'admin' | 'borrower';
}

class UpdateSettingsDto {
  @IsString()
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;
}

class ProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  loanType!: string;

  @IsIn(['reducing', 'flat'])
  interestMethod!: 'reducing' | 'flat';

  annualRatePercent!: number;
  minAmountCents!: number;
  maxAmountCents!: number;
  minTenureMonths!: number;
  maxTenureMonths!: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.admin.updateSetting(user, dto.key, dto.value);
  }

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Post('users/invite')
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.admin.inviteUser(user, dto);
  }

  @Get('loan-products')
  products() {
    return this.admin.listProducts();
  }

  @Post('loan-products')
  createProduct(@Body() dto: ProductDto) {
    return this.admin.createProduct(dto);
  }

  @Get('audit')
  audit() {
    return this.admin.auditLogs();
  }
}
