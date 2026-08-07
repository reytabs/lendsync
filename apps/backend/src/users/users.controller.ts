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
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
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
import { UsersService } from './users.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  occupation?: string;
}

class CreateBorrowerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(850)
  creditScore?: number;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('borrowers')
  @Roles('admin', 'loan_officer')
  borrowers() {
    return this.users.listBorrowers();
  }

  @Post('borrowers')
  @Roles('admin', 'loan_officer')
  createBorrower(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBorrowerDto,
  ) {
    return this.users.createBorrower(user, dto);
  }

  @Delete('borrowers/:id')
  @Roles('admin', 'loan_officer')
  deleteBorrower(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.deleteBorrower(user, id);
  }
}
