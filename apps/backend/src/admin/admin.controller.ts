import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
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

  @IsIn(['loan_officer', 'admin', 'viewer', 'collector', 'borrower'])
  role!: 'loan_officer' | 'admin' | 'viewer' | 'collector' | 'borrower';
}

class UpdateSettingsDto {
  @IsString()
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;
}

class ProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['business', 'personal', 'home_equity', 'auto', 'micro'])
  loanType!: string;

  @IsIn(['reducing', 'flat'])
  interestMethod!: 'reducing' | 'flat';

  @IsNumber()
  @Min(0)
  annualRatePercent!: number;

  @IsNumber()
  @Min(1)
  minAmountCents!: number;

  @IsNumber()
  @Min(1)
  maxAmountCents!: number;

  @IsNumber()
  @Min(1)
  minTenureMonths!: number;

  @IsNumber()
  @Min(1)
  maxTenureMonths!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['business', 'personal', 'home_equity', 'auto', 'micro'])
  loanType?: string;

  @IsOptional()
  @IsIn(['reducing', 'flat'])
  interestMethod?: 'reducing' | 'flat';

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRatePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minAmountCents?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAmountCents?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minTenureMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTenureMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
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

  @Patch('loan-products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.admin.updateProduct(id, dto);
  }

  @Post('loan-products/:id/active')
  setProductActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.admin.setProductActive(id, dto.isActive);
  }

  @Delete('loan-products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.admin.deleteProduct(id);
  }

  @Get('audit')
  audit() {
    return this.admin.auditLogs();
  }
}
