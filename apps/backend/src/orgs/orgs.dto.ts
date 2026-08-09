import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['USD', 'PHP'])
  currency?: 'USD' | 'PHP';

  @IsOptional()
  @IsIn(['starter', 'growth', 'scale'])
  planCode?: 'starter' | 'growth' | 'scale';
}

export class SwitchOrgDto {
  @IsString()
  organizationId!: string;
}
