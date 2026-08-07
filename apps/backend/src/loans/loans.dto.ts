import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  principalCents!: number;

  @IsInt()
  @Min(1)
  tenureMonths!: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  loanType?: string;

  /** Admin/officer may create on behalf of a borrower */
  @IsOptional()
  @IsUUID()
  borrowerId?: string;
}

export class LoanDecisionDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CalculateEmiDto {
  @IsInt()
  @Min(1)
  principalCents!: number;

  @IsNumber()
  @Min(0)
  annualRatePercent!: number;

  @IsInt()
  @Min(1)
  tenureMonths!: number;

  @IsOptional()
  @IsIn(['reducing', 'flat'])
  interestMethod?: 'reducing' | 'flat';
}
