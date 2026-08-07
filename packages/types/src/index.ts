export type UserRole = 'borrower' | 'loan_officer' | 'admin';

export type LoanStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'active'
  | 'completed'
  | 'defaulted'
  | 'closed';

export type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'disbursed'
  | 'rejected'
  | 'closed';

export type LoanType =
  | 'business'
  | 'personal'
  | 'home_equity'
  | 'auto'
  | 'micro';

export type InterestMethod = 'reducing' | 'flat';

export type DocumentType =
  | 'government_id'
  | 'proof_of_income'
  | 'collateral'
  | 'other';

export type DocumentStatus = 'pending' | 'verified' | 'rejected';

export type ScheduleStatus = 'upcoming' | 'paid' | 'overdue' | 'partial';

export type DisbursementStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  occupation?: string | null;
  creditScore?: number | null;
  kycStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface LoanProduct {
  id: string;
  name: string;
  description?: string | null;
  loanType: LoanType;
  interestMethod: InterestMethod;
  annualRatePercent: number;
  minAmountCents: number;
  maxAmountCents: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  graceDays: number;
  isActive: boolean;
}

export interface LoanApplication {
  id: string;
  borrowerId: string;
  productId: string;
  loanType: LoanType;
  principalCents: number;
  tenureMonths: number;
  annualRatePercent: number;
  purpose?: string | null;
  status: LoanStatus;
  officerId?: string | null;
  decisionNotes?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  applicationId: string;
  borrowerId: string;
  productId: string;
  loanType: LoanType;
  principalCents: number;
  tenureMonths: number;
  annualRatePercent: number;
  interestMethod: InterestMethod;
  status: LoanStatus;
  officerId?: string | null;
  disbursedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmiPreview {
  monthlyEmiCents: number;
  totalRepaymentCents: number;
  totalInterestCents: number;
  schedule: AmortizationRow[];
}

export interface AmortizationRow {
  month: number;
  dueDate?: string;
  paymentCents: number;
  principalCents: number;
  interestCents: number;
  balanceCents: number;
}

export interface DashboardKpis {
  totalPortfolioCents: number;
  activeLoans: number;
  portfolioDeltaPercent: number;
  disbursedThisMonthCents: number;
  disbursementsCount: number;
  disbursedDeltaPercent: number;
  collectionsTodayCents: number;
  paymentsCount: number;
  collectionsDeltaPercent: number;
  portfolioAtRiskPercent: number;
  overdueCents: number;
  parDeltaPercent: number;
}

export interface ReportKpis {
  avgLoanSizeCents: number;
  avgTenureMonths: number;
  avgInterestRatePercent: number;
  defaultRatePercent: number;
  recoveryRatePercent: number;
  niiThisMonthCents: number;
}

export interface AuthRegisterDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
}

export interface AuthLoginDto {
  email: string;
  password: string;
}

export interface CreateLoanDto {
  productId: string;
  principalCents: number;
  tenureMonths: number;
  purpose?: string;
  loanType?: LoanType;
}

export interface LoanDecisionDto {
  decision: 'approved' | 'rejected';
  notes?: string;
}

export interface CalculateEmiDto {
  principalCents: number;
  annualRatePercent: number;
  tenureMonths: number;
  interestMethod?: InterestMethod;
}

export interface CreateDisbursementDto {
  loanId: string;
}

export interface CreateRepaymentDto {
  loanId: string;
  amountCents: number;
  scheduleId?: string;
  stripePaymentIntentId?: string;
}
